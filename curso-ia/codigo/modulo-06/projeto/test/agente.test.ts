import assert from "node:assert/strict";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { Agente, MARCADOR_PODA } from "../src/agente.js";
import { criarLoja } from "../src/ferramentas.js";
import { ferramenta, modeloRoteirizado, texto } from "./modelo-roteirizado.js";

const SISTEMA = "Você atende clientes.";

test("fluxo feliz: chama a ferramenta, recebe o resultado, responde", async () => {
  const { client, requisicoes } = modeloRoteirizado([
    [ferramenta("consultar_pedido", { numero: "4822" })],
    [texto("Seu pedido 4822 foi enviado.")],
  ]);
  const loja = criarLoja();
  const r = await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: loja.ferramentas }).executar("status do 4822?");
  assert.equal(r.motivo, "concluido");
  assert.equal(r.passos, 2);
  assert.match(r.resposta, /enviado/);
  const resultado = (requisicoes[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
  assert.match(String(resultado.content), /"status":"enviado"/);
  assert.deepEqual(r.trajetoria.map((e) => e.tipo), ["inicio", "uso", "chamada", "resultado", "uso", "texto", "fim"]);
});

test("ação irreversível NEGADA: não executa e avisa o modelo", async () => {
  const { client, requisicoes } = modeloRoteirizado([
    [ferramenta("cancelar_pedido", { numero: "4821", motivo: "errado" })],
    [texto("Não foi possível cancelar.")],
  ]);
  const loja = criarLoja();
  const r = await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: loja.ferramentas, aprovar: async () => false }).executar("cancela");
  assert.equal(loja.pedidos["4821"].status, "separando", "o pedido NÃO pode ter sido cancelado");
  assert.ok(r.trajetoria.some((e) => e.tipo === "aprovacao" && !e.aprovada));
  const resultado = (requisicoes[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
  assert.equal(resultado.is_error, true);
  assert.match(String(resultado.content), /negou/);
});

test("sem aprovador configurado, irreversível é sempre negado", async () => {
  const { client } = modeloRoteirizado([[ferramenta("cancelar_pedido", { numero: "4821", motivo: "x".repeat(5) })], [texto("ok")]]);
  const loja = criarLoja();
  await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: loja.ferramentas }).executar("cancela");
  assert.equal(loja.pedidos["4821"].status, "separando");
});

test("ação irreversível APROVADA: executa", async () => {
  const { client } = modeloRoteirizado([[ferramenta("cancelar_pedido", { numero: "4821", motivo: "errado" })], [texto("Cancelado.")]]);
  const loja = criarLoja();
  await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: loja.ferramentas, aprovar: async () => true }).executar("cancela");
  assert.equal(loja.pedidos["4821"].status, "cancelado");
});

test("argumentos inválidos voltam como erro, sem executar", async () => {
  const { client, requisicoes } = modeloRoteirizado([[ferramenta("consultar_pedido", { numero: "abc" })], [texto("ok")]]);
  await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: criarLoja().ferramentas }).executar("x");
  const resultado = (requisicoes[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
  assert.equal(resultado.is_error, true);
  assert.match(String(resultado.content), /Argumentos inválidos: numero: só dígitos/);
});

test("chamadas paralelas: todos os resultados numa única mensagem", async () => {
  const { client, requisicoes } = modeloRoteirizado([
    [ferramenta("consultar_pedido", { numero: "4821" }), ferramenta("consultar_pedido", { numero: "4823" })],
    [texto("pronto")],
  ]);
  await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: criarLoja().ferramentas }).executar("x");
  const ultima = requisicoes[1].messages.at(-1)!;
  assert.equal(ultima.role, "user");
  assert.equal((ultima.content as unknown[]).length, 2);
});

test("orçamento de passos: para graciosamente", async () => {
  const sempreFerramenta = () => [ferramenta("listar_pedidos_do_cliente", { email: `a${Math.random()}@x.com` })];
  const { client } = modeloRoteirizado(Array(10).fill(sempreFerramenta));
  const r = await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: criarLoja().ferramentas, orcamento: { maxPassos: 3 } }).executar("x");
  assert.equal(r.motivo, "orcamento_passos");
  assert.equal(r.passos, 3);
});

test("orçamento de custo: para quando o gasto passa do teto", async () => {
  const sempreFerramenta = () => [ferramenta("listar_pedidos_do_cliente", { email: `b${Math.random()}@x.com` })];
  // 100 mil tokens de entrada no claude-opus-5-5 = US$ 0,40 por passo
  const { client } = modeloRoteirizado(Array(10).fill(sempreFerramenta), { entrada: 100_000, saida: 0 });
  const r = await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: criarLoja().ferramentas, orcamento: { maxCustoUsd: 1 } }).executar("x");
  assert.equal(r.motivo, "orcamento_custo");
  assert.equal(r.passos, 3);
  assert.ok(Math.abs(r.custoUsd - 1.2) < 1e-9);
});

test("detector de loop: mesma chamada 3 vezes interrompe", async () => {
  const mesma = () => [ferramenta("consultar_pedido", { numero: "9999" })];
  const { client } = modeloRoteirizado(Array(10).fill(mesma));
  const r = await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: criarLoja().ferramentas }).executar("x");
  assert.equal(r.motivo, "loop_detectado");
  assert.equal(r.passos, 3);
});

test("poda de contexto: só os N resultados mais recentes ficam íntegros", async () => {
  const roteiro = [1, 2, 3, 4].map((i) => () => [ferramenta("listar_pedidos_do_cliente", { email: `c${i}@x.com` })]);
  const { client, requisicoes } = modeloRoteirizado([...roteiro, () => [texto("fim")]]);
  const r = await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: criarLoja().ferramentas, manterResultados: 2 }).executar("x");
  const resultados = requisicoes.at(-1)!.messages.flatMap((m) =>
    Array.isArray(m.content) ? (m.content as Anthropic.ToolResultBlockParam[]).filter((b) => b.type === "tool_result") : [],
  );
  assert.equal(resultados.length, 4);
  assert.equal(resultados.filter((b) => b.content === MARCADOR_PODA).length, 2);
  assert.ok(r.trajetoria.some((e) => e.tipo === "poda"));
});

test("o agente informa o próprio orçamento no prompt de sistema", async () => {
  const { client, requisicoes } = modeloRoteirizado([[texto("oi")]]);
  await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: [], orcamento: { maxPassos: 4 } }).executar("x");
  assert.match(String(requisicoes[0].system), /no máximo 4 passos/);
});

test("ferramenta irreversível é anunciada como tal ao modelo", async () => {
  const { client, requisicoes } = modeloRoteirizado([[texto("oi")]]);
  await new Agente(client, { nome: "t", sistema: SISTEMA, ferramentas: criarLoja().ferramentas }).executar("x");
  const tools = requisicoes[0].tools as { name: string; description: string; input_schema: Record<string, unknown> }[];
  const cancelar = tools.find((t) => t.name === "cancelar_pedido")!;
  assert.match(cancelar.description, /IRREVERSÍVEL/);
  assert.equal(cancelar.input_schema.$schema, undefined);
  assert.equal(cancelar.input_schema.type, "object");
});
