/**
 * O gateway como serviço HTTP.
 *
 *   POST /v1/gerar     (cabeçalho x-chave-cliente)  → { texto, id, modelo, cache, custoUsd }
 *   GET  /v1/metricas                               → métricas agregadas (para o painel)
 *   GET  /                                          → painel de custos (public/painel.html)
 *
 *   GATEWAY_CLIENTES='chave-longa-1:app-suporte:5,chave-longa-2:app-relatorios:1' npm run gateway
 */
import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ErroGateway, Gateway, type Registro } from "./gateway.js";
import { calcularMetricas } from "./metricas.js";
import type { Cliente, Tarefa } from "./politicas.js";
import { carregarPrompts } from "./prompts.js";

const Pedido = z.object({
  tarefa: z.enum(["classificar", "extrair", "resumir", "geral"]),
  mensagens: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) })).min(1).max(30),
  maxTokens: z.number().int().min(1).max(8000).optional(),
  usarCache: z.boolean().optional(),
});

export function criarServidorGateway(gateway: Gateway, chaves: Map<string, string>) {
  return createServer(async (req, res) => {
    const json = (status: number, corpo: unknown) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(corpo));
    };
    try {
      if (req.method === "GET" && req.url === "/v1/metricas") return json(200, calcularMetricas(gateway.registros));
      if (req.method === "GET" && (req.url === "/" || req.url === "/painel")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'self'" });
        return res.end(await readFile(new URL("../public/painel.html", import.meta.url)));
      }
      const ESTATICOS: Record<string, string> = { "/painel.js": "text/javascript", "/painel.css": "text/css" };
      if (req.method === "GET" && req.url && ESTATICOS[req.url]) {
        res.writeHead(200, { "content-type": ESTATICOS[req.url] });
        return res.end(await readFile(new URL(`../public${req.url}`, import.meta.url)));
      }
      if (req.method !== "POST" || req.url !== "/v1/gerar") return json(404, { erro: "rota inexistente" });

      const cliente = chaves.get(String(req.headers["x-chave-cliente"] ?? ""));
      if (!cliente) return json(401, { erro: "chave de cliente inválida" });
      let corpo = "";
      for await (const p of req) {
        corpo += p;
        if (corpo.length > 600_000) return json(413, { erro: "pedido grande demais" });
      }
      const pedido = Pedido.safeParse(JSON.parse(corpo || "{}"));
      if (!pedido.success) return json(400, { erro: pedido.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      const id = String(req.headers["x-id-requisicao"] ?? "") || undefined;
      const { texto, registro } = await gateway.gerar(cliente, pedido.data, id);
      json(200, { texto, id: registro.id, modelo: registro.modelo, cache: registro.cache, custoUsd: registro.custoUsd, versaoPrompt: registro.versaoPrompt });
    } catch (e) {
      if (e instanceof ErroGateway) return json(e.status, { erro: e.message });
      if (e instanceof SyntaxError) return json(400, { erro: "JSON inválido" });
      console.error(e);
      json(500, { erro: "erro interno" });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chaves = new Map<string, string>();
  const clientes = new Map<string, Cliente>();
  for (const item of (process.env.GATEWAY_CLIENTES ?? "").split(",").filter(Boolean)) {
    const [chave, id, orcamento] = item.split(":");
    if (!chave || chave.length < 16) throw new Error("Chaves de cliente precisam de 16+ caracteres");
    chaves.set(chave, id);
    clientes.set(id, { id, orcamentoDiarioUsd: Number(orcamento ?? 1), tarefas: ["classificar", "extrair", "resumir", "geral"] as Tarefa[] });
  }
  if (!chaves.size) {
    console.error("Defina GATEWAY_CLIENTES, ex.: GATEWAY_CLIENTES=\"$(openssl rand -hex 16):app-suporte:5\"");
    process.exit(1);
  }
  const gateway = new Gateway(new Anthropic({ maxRetries: 0 }), clientes, carregarPrompts(new URL("../prompts/", import.meta.url)), {
    // Log estruturado: uma linha JSON por requisição. Mande para o seu sistema de logs.
    aoRegistrar: (r: Registro) => appendFileSync("gateway.jsonl", JSON.stringify(r) + "\n"),
  });
  const porta = Number(process.env.PORTA ?? 8787);
  criarServidorGateway(gateway, chaves).listen(porta, "127.0.0.1", () => console.error(`gateway em http://127.0.0.1:${porta} · painel em /`));
}
