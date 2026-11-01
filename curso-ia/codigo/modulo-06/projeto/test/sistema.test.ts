import assert from "node:assert/strict";
import { test } from "node:test";
import { avaliarTrajetoria, type Cenario } from "../src/avaliar-trajetoria.js";
import { MemoriaDeClientes } from "../src/memoria.js";
import { montarAtendimento } from "../src/montagem.js";
import type { Evento, ResultadoAgente } from "../src/tipos.js";
import { ferramenta, modeloRoteirizado, texto } from "./modelo-roteirizado.js";

// ---------------------------------------------------------------- supervisor
test("supervisor: roteia pelo modelo pequeno e entrega ao especialista com SUAS ferramentas", async () => {
  const { client, requisicoes } = modeloRoteirizado([
    [texto(JSON.stringify({ especialista: "pedidos", justificativa: "fala de um pedido" }))],
    [ferramenta("consultar_pedido", { numero: "4822" })],
    [texto("Enviado.")],
  ]);
  const { supervisor } = montarAtendimento(client, { cliente: "ana@exemplo.com" });
  const r = await supervisor.atender("cadê o 4822?");
  assert.equal(r.especialista, "pedidos");
  assert.equal(requisicoes[0].model, "claude-haiku-5-5", "roteamento usa o modelo barato");
  assert.equal(requisicoes[1].model, "claude-opus-5-5");
  const nomes = (requisicoes[1].tools as { name: string }[]).map((t) => t.name);
  assert.ok(nomes.includes("cancelar_pedido"));
});

test("supervisor: especialista de dúvidas não recebe ferramentas de pedido (menor privilégio)", async () => {
  const { client, requisicoes } = modeloRoteirizado([
    [texto(JSON.stringify({ especialista: "duvidas", justificativa: "pergunta geral" }))],
    [texto("Abrimos de segunda a sábado.")],
  ]);
  const { supervisor } = montarAtendimento(client, { cliente: "ana@exemplo.com" });
  await supervisor.atender("Vocês abrem domingo?");
  assert.deepEqual((requisicoes[1].tools as { name: string }[]).map((t) => t.name), ["abrir_chamado"]);
});

test("supervisor: rota inválida cai no especialista padrão", async () => {
  const { client } = modeloRoteirizado([
    [texto(JSON.stringify({ especialista: "financeiro", justificativa: "?" }))],
    [texto("ok")],
  ]);
  const { supervisor } = montarAtendimento(client, { cliente: "ana@exemplo.com" });
  assert.equal((await supervisor.atender("x")).especialista, "duvidas");
});

// ---------------------------------------------------------------- memória
test("memória: lembra entre conversas e entra no contexto do agente", async () => {
  const memoria = new MemoriaDeClientes();
  memoria.anotar("ana@exemplo.com", "Prefere contato por e-mail", "2026-10-01T00:00:00Z");
  const { client, requisicoes } = modeloRoteirizado([
    [texto(JSON.stringify({ especialista: "pedidos", justificativa: "x" }))],
    [texto("ok")],
  ]);
  await montarAtendimento(client, { cliente: "ana@exemplo.com", memoria }).supervisor.atender("oi");
  assert.match(String(requisicoes[1].system), /\(2026-10-01\) Prefere contato por e-mail/);
});

test("memória: recusa gravar CPF ou cartão", async () => {
  const f = new MemoriaDeClientes().ferramenta("x@y.com");
  assert.throws(() => f.executar({ nota: "CPF do cliente: 123.456.789-09" }), /dados sensíveis/);
  assert.throws(() => f.executar({ nota: "cartão 4111 1111 1111 1111" }), /dados sensíveis/);
  assert.equal(f.executar({ nota: "Gosta de entregas pela manhã" }), "anotado");
});

// ---------------------------------------------------------------- avaliação de trajetória
const res = (trajetoria: Evento[], extra: Partial<ResultadoAgente> = {}): ResultadoAgente => ({
  resposta: "Seu pedido foi cancelado.",
  motivo: "concluido",
  passos: 2,
  custoUsd: 0.01,
  trajetoria,
  ...extra,
});

test("avaliação: cancelamento com aprovação passa", () => {
  const c: Cenario = { id: "a", tarefa: "", deveChamar: ["cancelar_pedido"], respostaContem: ["cancelado"] };
  const t: Evento[] = [
    { tipo: "chamada", ferramenta: "cancelar_pedido", args: {}, id: "1" },
    { tipo: "aprovacao", ferramenta: "cancelar_pedido", args: {}, aprovada: true },
    { tipo: "resultado", ferramenta: "cancelar_pedido", id: "1", ok: true, resumo: "" },
  ];
  assert.ok(avaliarTrajetoria(c, res(t)).every((x) => x.passou));
});

test("avaliação: irreversível executado sem aprovação positiva é sempre reprovado", () => {
  const c: Cenario = { id: "b", tarefa: "" };
  const t: Evento[] = [
    { tipo: "aprovacao", ferramenta: "cancelar_pedido", args: {}, aprovada: false },
    { tipo: "resultado", ferramenta: "cancelar_pedido", id: "1", ok: true, resumo: "" },
  ];
  const falhas = avaliarTrajetoria(c, res(t)).filter((x) => !x.passou).map((x) => x.nome);
  assert.deepEqual(falhas, ["irreversível só com aprovação"]);
});

test("avaliação: resposta boa com caminho ruim (loop, passos demais) reprova", () => {
  const c: Cenario = { id: "c", tarefa: "", maxPassos: 3 };
  const falhas = avaliarTrajetoria(c, res([], { motivo: "loop_detectado", passos: 8 })).filter((x) => !x.passou).map((x) => x.nome);
  assert.deepEqual(falhas.sort(), ["concluiu", "eficiência"]);
});

test("os cenários do eval são válidos e cobrem aprovar e negar", async () => {
  const { readFileSync } = await import("node:fs");
  const cenarios: Cenario[] = readFileSync(new URL("../cenarios.jsonl", import.meta.url), "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  assert.ok(cenarios.length >= 8);
  assert.ok(cenarios.some((c) => c.aprovacao === "aprovar") && cenarios.some((c) => c.aprovacao === "negar"));
  assert.equal(new Set(cenarios.map((c) => c.id)).size, cenarios.length);
});
