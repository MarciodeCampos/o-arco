import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { ErroGateway, Gateway } from "../src/gateway.js";
import { calcularMetricas } from "../src/metricas.js";
import type { Cliente } from "../src/politicas.js";
import { balde, carregarPrompts, escolherVersao } from "../src/prompts.js";
import { criarServidorGateway } from "../src/servidor.js";

type Comportamento = "ok" | "429" | "500" | "400" | "recusa";

/** Provedor falso: cada modelo se comporta como configurado; registra quem foi chamado. */
function provedorFalso(comportamento: Record<string, Comportamento> = {}) {
  const chamadas: { model: string; system: string }[] = [];
  const fetchFalso: typeof fetch = async (_url, init) => {
    const corpo = JSON.parse(String(init?.body));
    chamadas.push({ model: corpo.model, system: corpo.system });
    const c = comportamento[corpo.model] ?? "ok";
    const erro = (status: number, tipo: string) =>
      new Response(JSON.stringify({ type: "error", error: { type: tipo, message: tipo } }), { status, headers: { "content-type": "application/json" } });
    if (c === "429") return erro(429, "rate_limit_error");
    if (c === "500") return erro(500, "api_error");
    if (c === "400") return erro(400, "invalid_request_error");
    return new Response(
      JSON.stringify({
        id: "msg", type: "message", role: "assistant", model: corpo.model, stop_sequence: null,
        stop_reason: c === "recusa" ? "refusal" : "end_turn",
        usage: { input_tokens: 1000, output_tokens: 100 },
        content: c === "recusa" ? [] : [{ type: "text", text: `resposta de ${corpo.model}` }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return { client: new Anthropic({ apiKey: "x", fetch: fetchFalso, maxRetries: 0 }), chamadas };
}

const prompts = carregarPrompts(new URL("../prompts/", import.meta.url));
const clientes = new Map<string, Cliente>([
  ["suporte", { id: "suporte", orcamentoDiarioUsd: 0.05, tarefas: ["classificar", "resumir", "geral", "extrair"] }],
  ["relatorios", { id: "relatorios", orcamentoDiarioUsd: 1, tarefas: ["resumir"] }],
]);
const msg = (t: string) => [{ role: "user" as const, content: t }];

test("roteia por tarefa: classificar vai para o modelo pequeno, geral para o grande", async () => {
  const p = provedorFalso();
  const g = new Gateway(p.client, clientes, prompts);
  assert.equal((await g.gerar("suporte", { tarefa: "classificar", mensagens: msg("a") })).registro.modelo, "claude-haiku-5-5");
  assert.equal((await g.gerar("suporte", { tarefa: "geral", mensagens: msg("b") })).registro.modelo, "claude-opus-5-5");
});

test("reserva: 429 ou 500 no preferido cai no próximo da cadeia", async () => {
  const p = provedorFalso({ "claude-opus-5-5": "429" });
  const g = new Gateway(p.client, clientes, prompts);
  const { registro } = await g.gerar("suporte", { tarefa: "geral", mensagens: msg("c") });
  assert.equal(registro.modelo, "claude-sonnet-5-5");
  assert.deepEqual(registro.tentativas.map((t) => t.modelo), ["claude-opus-5-5", "claude-sonnet-5-5"]);
});

test("reserva também em recusa", async () => {
  const p = provedorFalso({ "claude-haiku-5-5": "recusa" });
  const { registro } = await new Gateway(p.client, clientes, prompts).gerar("suporte", { tarefa: "classificar", mensagens: msg("d") });
  assert.equal(registro.modelo, "claude-sonnet-5-5");
});

test("erro do pedido (400) NÃO tenta outro modelo: o problema é o pedido, não o modelo", async () => {
  const p = provedorFalso({ "claude-opus-5-5": "400" });
  await assert.rejects(new Gateway(p.client, clientes, prompts).gerar("suporte", { tarefa: "geral", mensagens: msg("e") }), (e: ErroGateway) => e.status === 400);
  assert.equal(p.chamadas.length, 1);
});

test("todos falham: 503", async () => {
  const p = provedorFalso({ "claude-opus-5-5": "500", "claude-sonnet-5-5": "500" });
  await assert.rejects(new Gateway(p.client, clientes, prompts).gerar("suporte", { tarefa: "geral", mensagens: msg("f") }), (e: ErroGateway) => e.status === 503);
});

test("cache: o mesmo pedido não chama o provedor de novo; usarCache:false força nova chamada", async () => {
  const p = provedorFalso();
  const g = new Gateway(p.client, clientes, prompts);
  const pedido = { tarefa: "resumir" as const, mensagens: msg("texto longo") };
  await g.gerar("relatorios", pedido, "id-1");
  const segunda = await g.gerar("relatorios", pedido, "id-2");
  assert.equal(segunda.registro.cache, true);
  assert.equal(segunda.registro.custoUsd, 0);
  assert.equal(p.chamadas.length, 1);
  await g.gerar("relatorios", { ...pedido, usarCache: false }, "id-3");
  assert.equal(p.chamadas.length, 2);
});

test("cache expira pelo TTL", async () => {
  let agora = new Date("2026-11-01T10:00:00Z");
  const p = provedorFalso();
  const g = new Gateway(p.client, clientes, prompts, { ttlCacheMs: 60_000, agora: () => agora });
  const pedido = { tarefa: "resumir" as const, mensagens: msg("x") };
  await g.gerar("relatorios", pedido);
  agora = new Date("2026-11-01T10:02:00Z");
  await g.gerar("relatorios", pedido);
  assert.equal(p.chamadas.length, 2);
});

test("cota diária: recusa quando o gasto do dia passa do teto, e libera no dia seguinte", async () => {
  let agora = new Date("2026-11-01T10:00:00Z");
  const p = provedorFalso();
  const g = new Gateway(p.client, clientes, prompts, { agora: () => agora });
  // cada chamada no opus: 1000 × $4 + 100 × $20 por milhão = US$ 0,006; teto de US$ 0,05
  let n = 0;
  await assert.rejects(async () => {
    for (; n < 20; n++) await g.gerar("suporte", { tarefa: "geral", mensagens: msg(`p${n}`) });
  }, (e: ErroGateway) => e.status === 429);
  assert.equal(n, 9); // 9 × 0,006 = 0,054 ≥ 0,05 → a 10ª é recusada
  agora = new Date("2026-11-02T08:00:00Z");
  await g.gerar("suporte", { tarefa: "geral", mensagens: msg("novo dia") });
});

test("autorização por tarefa: 403", async () => {
  const g = new Gateway(provedorFalso().client, clientes, prompts);
  await assert.rejects(g.gerar("relatorios", { tarefa: "geral", mensagens: msg("x") }), (e: ErroGateway) => e.status === 403);
  await assert.rejects(g.gerar("desconhecido", { tarefa: "resumir", mensagens: msg("x") }), (e: ErroGateway) => e.status === 403);
});

test("canário: ~10% das requisições usam a versão candidata, de forma determinística", () => {
  const ids = Array.from({ length: 5000 }, (_, i) => `req-${i}`);
  const candidatas = ids.filter((id) => escolherVersao(prompts.classificar, id).versao === "v2").length;
  assert.ok(candidatas > 400 && candidatas < 600, `${candidatas} de 5000`);
  assert.equal(escolherVersao(prompts.classificar, "req-42").versao, escolherVersao(prompts.classificar, "req-42").versao);
  assert.ok(balde("a") >= 0 && balde("a") < 1);
});

test("a versão do prompt vai para o provedor e para o registro", async () => {
  const p = provedorFalso();
  const g = new Gateway(p.client, clientes, prompts);
  const id = Array.from({ length: 200 }, (_, i) => `id-${i}`).find((x) => balde(x) < 0.1)!;
  const { registro } = await g.gerar("suporte", { tarefa: "classificar", mensagens: msg("y") }, id);
  assert.equal(registro.versaoPrompt, "v2");
  assert.match(p.chamadas[0].system, /desempate|mais urgente/);
});

test("métricas agregam custo, cache, reserva e versões", async () => {
  const p = provedorFalso({ "claude-opus-5-5": "429" });
  const g = new Gateway(p.client, clientes, prompts);
  await g.gerar("suporte", { tarefa: "geral", mensagens: msg("1") });
  await g.gerar("suporte", { tarefa: "geral", mensagens: msg("1") }); // cache
  const m = calcularMetricas(g.registros);
  assert.equal(m.requisicoes, 2);
  assert.equal(m.taxaCache, 0.5);
  assert.equal(m.usaramReserva, 1);
  assert.ok(Math.abs(m.porModelo["claude-sonnet-5-5"].custoUsd - 0.003) < 1e-9);
});

test("HTTP: chave obrigatória, validação, resposta e painel com CSP", async () => {
  const g = new Gateway(provedorFalso().client, clientes, prompts);
  const s = criarServidorGateway(g, new Map([["chave-de-teste-muito-longa", "suporte"]]));
  await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  const post = (corpo: unknown, chave = "chave-de-teste-muito-longa") =>
    fetch(`${base}/v1/gerar`, { method: "POST", headers: { "x-chave-cliente": chave }, body: JSON.stringify(corpo) });
  try {
    assert.equal((await post({}, "errada")).status, 401);
    assert.equal((await post({ tarefa: "traduzir", mensagens: [] })).status, 400);
    const r = await post({ tarefa: "resumir", mensagens: msg("oi") });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).modelo, "claude-sonnet-5-5");
    assert.equal((await (await fetch(`${base}/v1/metricas`)).json()).requisicoes, 1);
    const painel = await fetch(`${base}/`);
    assert.match(painel.headers.get("content-security-policy") ?? "", /default-src 'self'/);
    assert.equal((await fetch(`${base}/painel.css`)).status, 200);
  } finally {
    s.close();
  }
});
