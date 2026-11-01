/**
 * Back-end do app: o navegador NUNCA fala direto com a API do LLM.
 *
 *   POST /api/chat      → resposta em streaming (Server-Sent Events)
 *   POST /api/analisar  → análise estruturada de uma imagem (JSON)
 *   GET  /*             → arquivos de public/
 *
 * Por que um back-end no meio:
 *  - a chave da API fica no servidor (no navegador, qualquer um a copiaria)
 *  - você valida e limita entradas antes de gastar tokens
 *  - você controla o prompt de sistema, o modelo e o custo por usuário
 */
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const PUBLICO = resolve(fileURLToPath(new URL("../public/", import.meta.url)));
const MODELO = process.env.MODELO ?? "claude-opus-5-5";
const LIMITE_CORPO = 6 * 1024 * 1024; // 6 MB (imagem em base64 ocupa ~4/3 do tamanho original)
const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

const SISTEMA_CHAT =
  "Você é o assistente de uma loja online. Responda em português do Brasil, de forma clara e breve. " +
  "Use parágrafos curtos; listas só quando ajudarem.";

const EntradaChat = z.object({
  mensagens: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20)
    .refine((ms) => ms.length > 0 && ms[0].role === "user" && ms.at(-1)!.role === "user", "a conversa começa e termina com o usuário"),
});

const EntradaImagem = z.object({
  imagem: z.string().regex(/^data:image\/[a-z0-9.+-]+;base64,/, "envie a imagem como data URL base64"),
  pergunta: z.string().max(500).optional(),
});

export const AnaliseImagem = z.object({
  tipo: z.enum(["nota_fiscal", "etiqueta_produto", "documento", "foto_produto", "outro"]),
  descricao: z.string().describe("Uma frase sobre o que a imagem mostra"),
  texto_legivel: z.array(z.string()).describe("Principais trechos de texto legíveis na imagem, na ordem"),
  valores: z.array(z.object({ rotulo: z.string(), valor: z.string() })).describe("Pares rótulo/valor encontrados (total, data, CNPJ...)"),
  alertas: z.array(z.string()).describe("Problemas: imagem borrada, cortada, texto ilegível, dados sensíveis visíveis"),
  confianca: z.enum(["alta", "media", "baixa"]),
});

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

function json(res: ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

async function lerJson(req: IncomingMessage): Promise<unknown> {
  let total = 0;
  const partes: Buffer[] = [];
  for await (const p of req) {
    total += p.length;
    if (total > LIMITE_CORPO) throw Object.assign(new Error("Arquivo grande demais (máx. ~4 MB de imagem)"), { status: 413 });
    partes.push(p);
  }
  try {
    return JSON.parse(Buffer.concat(partes).toString("utf-8"));
  } catch {
    throw Object.assign(new Error("JSON inválido"), { status: 400 });
  }
}

/** Limite simples por IP: N requisições por minuto. */
function criarLimitador(porMinuto: number) {
  const janelas = new Map<string, { inicio: number; n: number }>();
  return (ip: string) => {
    const agora = Date.now();
    const j = janelas.get(ip);
    if (!j || agora - j.inicio > 60_000) {
      janelas.set(ip, { inicio: agora, n: 1 });
      return true;
    }
    return ++j.n <= porMinuto;
  };
}

export function criarServidor(client: Anthropic, opcoes: { porMinuto?: number } = {}) {
  const permitir = criarLimitador(opcoes.porMinuto ?? 30);

  async function chat(req: IncomingMessage, res: ServerResponse) {
    const entrada = EntradaChat.safeParse(await lerJson(req));
    if (!entrada.success) return json(res, 400, { erro: entrada.error.issues.map((i) => i.message).join("; ") });

    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive" });
    const enviar = (evento: string, dados: unknown) => res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);

    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 4000,
      system: SISTEMA_CHAT,
      messages: entrada.data.mensagens,
      output_config: { effort: "low" },
    });
    // Usuário fechou a aba ou clicou em "parar": cancela a geração e para de pagar tokens.
    res.on("close", () => stream.abort());
    stream.on("text", (pedaco) => enviar("texto", { pedaco }));
    try {
      const final = await stream.finalMessage();
      enviar("fim", { stop_reason: final.stop_reason, tokens: final.usage.output_tokens });
    } catch (erro) {
      if (!res.writableEnded) enviar("erro", { mensagem: erro instanceof Anthropic.APIUserAbortError ? "cancelado" : "Falha ao gerar a resposta" });
    }
    res.end();
  }

  async function analisar(req: IncomingMessage, res: ServerResponse) {
    const entrada = EntradaImagem.safeParse(await lerJson(req));
    if (!entrada.success) return json(res, 400, { erro: entrada.error.issues.map((i) => i.message).join("; ") });
    const [cabecalho, dados] = entrada.data.imagem.split(",", 2);
    const tipo = cabecalho.slice(5, cabecalho.indexOf(";")) as (typeof TIPOS_IMAGEM)[number];
    // Não confie no rótulo: confira o tipo declarado E os primeiros bytes do arquivo.
    if (!TIPOS_IMAGEM.includes(tipo) || !assinaturaConfere(tipo, dados)) {
      return json(res, 415, { erro: "Envie uma imagem PNG, JPEG, WebP ou GIF válida" });
    }
    const r = await client.messages.parse({
      model: MODELO,
      max_tokens: 4000,
      system: "Você analisa imagens enviadas por clientes de uma loja. Descreva só o que está visível; não invente valores ilegíveis.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: tipo, data: dados } },
            { type: "text", text: entrada.data.pergunta || "Analise esta imagem." },
          ],
        },
      ],
      output_config: { effort: "low", format: zodOutputFormat(AnaliseImagem) },
    });
    if (r.stop_reason === "refusal" || !r.parsed_output) return json(res, 422, { erro: "Não foi possível analisar a imagem" });
    json(res, 200, { analise: r.parsed_output, tokens: r.usage });
  }

  async function estatico(req: IncomingMessage, res: ServerResponse) {
    const caminho = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    const alvo = normalize(join(PUBLICO, caminho === "/" ? "index.html" : caminho));
    if (!alvo.startsWith(PUBLICO)) return json(res, 403, { erro: "proibido" }); // bloqueia ../../
    try {
      const conteudo = await readFile(alvo);
      res.writeHead(200, {
        "content-type": MIME[extname(alvo)] ?? "application/octet-stream",
        // Política de segurança: só scripts do próprio site, nada inline. Ajuda contra XSS.
        "content-security-policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self'",
      });
      res.end(conteudo);
    } catch {
      json(res, 404, { erro: "não encontrado" });
    }
  }

  return createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url?.startsWith("/api/")) {
        if (!permitir(req.socket.remoteAddress ?? "?")) return json(res, 429, { erro: "Muitas requisições, aguarde um minuto" });
        if (req.url === "/api/chat") return await chat(req, res);
        if (req.url === "/api/analisar") return await analisar(req, res);
        return json(res, 404, { erro: "rota inexistente" });
      }
      if (req.method === "GET") return await estatico(req, res);
      json(res, 405, { erro: "método não permitido" });
    } catch (erro) {
      const status = (erro as { status?: number }).status ?? 500;
      if (status === 500) console.error(erro);
      if (status === 413) {
        // O cliente ainda está enviando o corpo gigante: responda e feche a conexão,
        // em vez de deixá-la num estado que quebra a próxima requisição.
        res.setHeader("connection", "close");
        res.on("finish", () => req.destroy());
      }
      if (!res.headersSent) json(res, status, { erro: status === 500 ? "Erro interno" : (erro as Error).message });
      else res.end();
    }
  });
}

const ASSINATURAS: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};
export function assinaturaConfere(tipo: string, base64: string): boolean {
  const bytes = Buffer.from(base64.slice(0, 24), "base64");
  return (ASSINATURAS[tipo] ?? []).every((b, i) => bytes[i] === b);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const porta = Number(process.env.PORTA ?? 3000);
  criarServidor(new Anthropic()).listen(porta, "127.0.0.1", () => console.log(`http://127.0.0.1:${porta}`));
}
