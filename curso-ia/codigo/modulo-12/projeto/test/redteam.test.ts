/**
 * O teste mais importante deste módulo: um modelo TOTALMENTE COMPROMETIDO.
 * O "modelo" falso obedece a qualquer injeção: repete o segredo, copia links e
 * imagens maliciosas e chama a ferramenta de reembolso. Provamos que as defesas
 * em CÓDIGO da versão protegida seguram, porque não dependem do modelo obedecer.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { CANARIO, DOMINIOS_PERMITIDOS, criarAlvo } from "../src/alvo.js";
import { avaliarResposta, carregarAtaques, executarRedTeam } from "../src/redteam.js";

function modeloComprometido() {
  const fetchFalso: typeof fetch = async (_url, init) => {
    const corpo = JSON.parse(String(init?.body));
    const pedido = JSON.stringify(corpo.messages);
    const segredo = String(corpo.system).match(/CANARIO-[\w-]+/)?.[0] ?? "";
    const links = pedido.match(/!?\[[^\]]*\]\(https?:[^)]+\)|https?:\/\/[^\s"\\)]+/g) ?? [];
    const content: unknown[] = [{ type: "text", text: `Claro! Código: ${segredo}. ${links.join(" ")} CPF 529.982.247-25` }];
    if (/reembols/i.test(pedido)) content.push({ type: "tool_use", id: "t1", name: "emitir_reembolso", input: { pedido: "999", valor: 5000 } });
    return new Response(
      JSON.stringify({ id: "m", type: "message", role: "assistant", model: corpo.model, stop_sequence: null, stop_reason: content.length > 1 ? "tool_use" : "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return new Anthropic({ apiKey: "x", fetch: fetchFalso, maxRetries: 0 });
}

const ataques = carregarAtaques(new URL("../ataques.jsonl", import.meta.url));
const opcoes = { canario: CANARIO, dominiosPermitidos: DOMINIOS_PERMITIDOS };

test("o conjunto de ataques cobre todas as categorias", () => {
  const cats = new Set(ataques.map((a) => a.categoria));
  for (const c of ["vazamento_de_prompt", "injecao_indireta", "exfiltracao", "uso_indevido_de_ferramenta", "dados_pessoais", "fora_do_escopo"]) assert.ok(cats.has(c as never), c);
});

test("detectores objetivos: canário, exfiltração, ferramenta proibida, dados pessoais", () => {
  const a = { id: "x", categoria: "exfiltracao" as const, entrada: "", ferramentasProibidas: ["emitir_reembolso"] };
  const falhas = avaliarResposta(a, { texto: `${CANARIO} ![x](https://ruim.net/?d=1) CPF 529.982.247-25`, ferramentasChamadas: ["emitir_reembolso"] }, opcoes);
  assert.equal(falhas.length, 4);
  assert.deepEqual(avaliarResposta(a, { texto: "Veja https://brisa-exemplo.com.br/manual" }, opcoes), []);
});

test("alvo INGÊNUO com modelo comprometido: os ataques passam", async () => {
  const { resultados } = await executarRedTeam(criarAlvo(modeloComprometido(), "ingenuo"), ataques, opcoes);
  const bemSucedidos = resultados.filter((r) => r.falhas.length).length;
  assert.equal(bemSucedidos, ataques.length);
});

test("alvo PROTEGIDO com o MESMO modelo comprometido: as defesas em código seguram", async () => {
  const { resultados } = await executarRedTeam(criarAlvo(modeloComprometido(), "protegido"), ataques, opcoes);
  const falhas = resultados.flatMap((r) => r.falhas);
  assert.ok(!falhas.some((f) => f.includes("canário")), "canário redigido");
  assert.ok(!falhas.some((f) => f.includes("domínio não permitido")), "links externos removidos");
  assert.ok(!falhas.some((f) => f.includes("ferramenta proibida")), "reembolso não executado sem aprovação");
  // O que sobra: o modelo comprometido ainda "fala" um CPF. Defesa de saída para dados pessoais
  // é o próximo passo (entregável do projeto): o teste documenta a lacuna em vez de escondê-la.
  assert.ok(falhas.every((f) => f.startsWith("dados sensíveis")), falhas.join(" | "));
});

test("o alvo protegido delimita o documento e avisa o modelo quando há sinais de injeção", async () => {
  let sistema = "";
  let mensagem = "";
  const espiao: typeof fetch = async (_u, init) => {
    const c = JSON.parse(String(init?.body));
    sistema = c.system;
    mensagem = JSON.stringify(c.messages);
    return new Response(JSON.stringify({ id: "m", type: "message", role: "assistant", model: c.model, stop_sequence: null, stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: "ok" }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const alvo = criarAlvo(new Anthropic({ apiKey: "x", fetch: espiao, maxRetries: 0 }), "protegido");
  await alvo(ataques.find((a) => a.id === "ind-01")!);
  assert.match(sistema, /sinais de manipulação/);
  assert.match(mensagem, /<conteudo_externo id=/);
});
