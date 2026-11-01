/**
 * Servidor MCP pelo transporte Streamable HTTP: para clientes remotos, outros times
 * e agentes rodando em outras máquinas.
 *
 *   MCP_TOKENS="um-token-bem-longo-e-aleatorio:time-suporte" npm run servidor:http
 *
 * Endpoint: POST http://localhost:3333/mcp  (cabeçalho Authorization: Bearer <token>)
 * Proteções: autenticação por token, limite de taxa por cliente, limite de tamanho do
 * corpo, auditoria em auditoria.jsonl e liberação só para localhost por padrão.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Indice } from "./indice.js";
import { LimitadorDeTaxa, autenticar, carregarTokens, criarAuditoria, type Tokens } from "./protecoes.js";
import { criarServidor, type Auditoria } from "./servidor.js";

const LIMITE_CORPO = 64 * 1024; // 64 KB: nenhuma chamada legítima precisa de mais

function responderErro(res: ServerResponse, status: number, mensagem: string, extras: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...extras });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: mensagem }, id: null }));
}

async function lerCorpo(req: IncomingMessage): Promise<unknown> {
  let tamanho = 0;
  const pedacos: Buffer[] = [];
  for await (const p of req) {
    tamanho += p.length;
    if (tamanho > LIMITE_CORPO) throw new Error("corpo grande demais");
    pedacos.push(p);
  }
  return JSON.parse(Buffer.concat(pedacos).toString("utf-8"));
}

export function criarServidorHttp(
  indice: Indice,
  opcoes: { tokens: Tokens; limitador?: LimitadorDeTaxa; auditar?: Auditoria },
): Server {
  const limitador = opcoes.limitador ?? new LimitadorDeTaxa();

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/saude") return void res.writeHead(200).end("ok");
    if (url.pathname !== "/mcp") return responderErro(res, 404, "Não encontrado");
    // Modo sem sessão (stateless): cada POST é independente. GET/DELETE só existem com sessão.
    if (req.method !== "POST") return responderErro(res, 405, "Método não permitido", { allow: "POST" });

    // 1. Autenticação: antes de qualquer trabalho.
    const credencial = autenticar(req.headers.authorization, opcoes.tokens);
    if (!credencial) return responderErro(res, 401, "Não autorizado", { "www-authenticate": "Bearer" });

    // 2. Limite de taxa por cliente.
    const taxa = limitador.permitir(credencial.clientId);
    if (!taxa.ok) return responderErro(res, 429, "Muitas requisições", { "retry-after": String(taxa.tenteEmS) });

    // 3. Corpo com tamanho limitado.
    let corpo: unknown;
    try {
      corpo = await lerCorpo(req);
    } catch (e) {
      return responderErro(res, 400, e instanceof Error ? e.message : "Corpo inválido");
    }

    // 4. Um servidor MCP novo por requisição (stateless), com a identidade do cliente anexada.
    const servidor = criarServidor(indice, opcoes.auditar);
    const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transporte.close();
      void servidor.close();
    });
    try {
      await servidor.connect(transporte);
      const autenticado = Object.assign(req, {
        auth: { token: "redigido", clientId: credencial.clientId, scopes: credencial.escopos },
      });
      await transporte.handleRequest(autenticado, res, corpo);
    } catch (erro) {
      console.error("[mcp-http] erro:", erro);
      if (!res.headersSent) responderErro(res, 500, "Erro interno");
    }
  });
}

// Execução direta: npm run servidor:http
if (import.meta.url === `file://${process.argv[1]}`) {
  const { abrirIndiceDoModulo4 } = await import("./indice.js");
  const tokens = carregarTokens();
  if (!tokens.length) {
    console.error('Defina MCP_TOKENS, por exemplo: MCP_TOKENS="$(openssl rand -hex 24):meu-cliente"');
    process.exit(1);
  }
  const porta = Number(process.env.PORTA ?? 3333);
  const host = process.env.HOST ?? "127.0.0.1"; // só localhost, a menos que você decida expor
  const indice = await abrirIndiceDoModulo4();
  criarServidorHttp(indice, { tokens, auditar: criarAuditoria("auditoria.jsonl") }).listen(porta, host, () => {
    console.error(`[documentacao-brisa] http://${host}:${porta}/mcp · ${tokens.length} cliente(s) · auditoria em auditoria.jsonl`);
  });
}
