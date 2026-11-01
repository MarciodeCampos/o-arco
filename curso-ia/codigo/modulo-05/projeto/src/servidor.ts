/**
 * O servidor MCP da documentação da Brisa.
 *
 * Expõe o RAG do Módulo 4 pelas três primitivas do protocolo:
 *   ferramentas → buscar_documentacao, ler_secao, listar_documentos
 *   recursos    → docs://{documento}  (o markdown completo de cada documento)
 *   prompt      → atendimento         (modelo de atendimento ao cliente)
 *
 * A função recebe um `auditar` opcional: o transporte HTTP usa isso para registrar
 * quem chamou o quê. O servidor em si não sabe de onde vem a conexão.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buscar } from "../../../modulo-04/projeto/src/busca.js";
import type { Indice } from "./indice.js";

export type Auditoria = (evento: { ferramenta: string; argumentos: unknown; cliente?: string; ok: boolean; ms: number }) => void;

const ResultadoBusca = {
  resultados: z.array(
    z.object({ id: z.string(), documento: z.string(), secao: z.string(), texto: z.string(), pontuacao: z.number() }),
  ),
};

export function criarServidor(indice: Indice, auditar?: Auditoria): McpServer {
  const servidor = new McpServer(
    { name: "documentacao-brisa", version: "1.0.0" },
    {
      // Instruções que o cliente pode mostrar ao modelo: quando e como usar este servidor.
      instructions:
        "Documentação oficial da Brisa (purificadores de ar): manual, garantia, entregas, assinatura de filtros, " +
        "aplicativo e privacidade. Use buscar_documentacao antes de responder dúvidas de clientes e cite o id dos trechos.",
    },
  );

  /** Envolve um handler para medir tempo e registrar na auditoria, com sucesso ou falha. */
  function comAuditoria<A, R>(ferramenta: string, fn: (args: A) => Promise<R>) {
    return async (args: A, extra: { authInfo?: { clientId: string } }): Promise<R> => {
      const inicio = performance.now();
      try {
        const r = await fn(args);
        auditar?.({ ferramenta, argumentos: args, cliente: extra.authInfo?.clientId, ok: true, ms: performance.now() - inicio });
        return r;
      } catch (erro) {
        auditar?.({ ferramenta, argumentos: args, cliente: extra.authInfo?.clientId, ok: false, ms: performance.now() - inicio });
        throw erro; // o SDK transforma em resultado com isError: true, que o modelo consegue ler
      }
    };
  }

  // ---------------------------------------------------------------- ferramentas
  servidor.registerTool(
    "buscar_documentacao",
    {
      title: "Buscar na documentação",
      description:
        "Busca trechos da documentação da Brisa relevantes para uma pergunta. Devolve até k trechos com id, " +
        "documento, seção e texto. Use frases completas na pergunta. Se nada relevante voltar, não invente: " +
        "diga que a documentação não cobre o assunto.",
      inputSchema: {
        pergunta: z.string().min(3).describe("A dúvida do cliente, em linguagem natural"),
        k: z.number().int().min(1).max(10).default(5).describe("Quantos trechos devolver"),
      },
      outputSchema: ResultadoBusca,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    comAuditoria("buscar_documentacao", async ({ pergunta, k }: { pergunta: string; k: number }) => {
      const achados = await buscar(indice.banco, indice.embedder, pergunta, "hibrida", k);
      const resultados = achados.map((r) => ({
        id: r.id,
        documento: r.tituloDoc,
        secao: r.secao,
        texto: r.texto,
        pontuacao: Number(r.pontuacao),
      }));
      return {
        // texto para o modelo ler...
        content: [
          {
            type: "text" as const,
            text: resultados.length
              ? resultados.map((r) => `[${r.id}] ${r.documento} — ${r.secao}\n${r.texto}`).join("\n\n---\n\n")
              : "Nenhum trecho encontrado.",
          },
        ],
        // ...e os mesmos dados estruturados, para código que consome o resultado
        structuredContent: { resultados },
      };
    }),
  );

  servidor.registerTool(
    "ler_secao",
    {
      title: "Ler seção",
      description: "Lê o texto completo de uma seção pelo id devolvido em buscar_documentacao (ex.: entregas#frete-gratis).",
      inputSchema: { id: z.string().describe("Id do trecho, no formato documento#secao") },
      annotations: { readOnlyHint: true },
    },
    comAuditoria("ler_secao", async ({ id }: { id: string }) => {
      const todos = await indice.banco.todos();
      const t = todos.find((x) => x.id === id);
      if (!t) {
        const parecidos = todos.filter((x) => x.id.startsWith(id.split("#")[0])).slice(0, 5).map((x) => x.id);
        // Erro com dica: o modelo consegue se corrigir na próxima chamada.
        throw new Error(`Seção "${id}" não existe.${parecidos.length ? ` Ids parecidos: ${parecidos.join(", ")}` : ""}`);
      }
      return { content: [{ type: "text" as const, text: `${t.tituloDoc} — ${t.secao}\n\n${t.texto}` }] };
    }),
  );

  servidor.registerTool(
    "listar_documentos",
    {
      title: "Listar documentos",
      description: "Lista os documentos disponíveis e suas seções.",
      annotations: { readOnlyHint: true },
    },
    // Ferramenta sem parâmetros: o SDK chama o handler só com `extra`.
    (extra) =>
      comAuditoria("listar_documentos", async () => {
        const porDoc = new Map<string, string[]>();
        for (const t of await indice.banco.todos()) porDoc.set(t.doc, [...(porDoc.get(t.doc) ?? []), t.secao]);
        const texto = [...porDoc].map(([doc, secoes]) => `${doc}: ${secoes.join("; ")}`).join("\n");
        return { content: [{ type: "text" as const, text: texto }] };
      })({}, extra),
  );

  // ---------------------------------------------------------------- recursos
  servidor.registerResource(
    "documento",
    new ResourceTemplate("docs://{documento}", {
      list: async () => ({
        resources: [...indice.docs.keys()].map((nome) => ({
          uri: `docs://${nome}`,
          name: nome,
          mimeType: "text/markdown",
        })),
      }),
    }),
    { title: "Documento da Brisa", description: "Markdown completo de um documento", mimeType: "text/markdown" },
    async (uri, { documento }) => {
      const md = indice.docs.get(String(documento));
      if (!md) throw new Error(`Documento ${documento} não existe`);
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: md }] };
    },
  );

  // ---------------------------------------------------------------- prompt
  servidor.registerPrompt(
    "atendimento",
    {
      title: "Atender cliente",
      description: "Monta a instrução para responder a dúvida de um cliente usando a documentação.",
      argsSchema: { pergunta: z.string().describe("A mensagem do cliente") },
    },
    ({ pergunta }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Um cliente da Brisa perguntou:\n\n<mensagem>\n${pergunta}\n</mensagem>\n\n` +
              "Use a ferramenta buscar_documentacao, responda em até 5 frases e cite os ids dos trechos usados. " +
              "Se a documentação não cobrir o assunto, diga isso e ofereça o suporte humano.",
          },
        },
      ],
    }),
  );

  return servidor;
}
