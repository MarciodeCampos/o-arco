import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { ferramenta, modeloRoteirizado, texto } from "../../../modulo-06/projeto/test/modelo-roteirizado.js";
import { ClusterSimulado, carregarCenario } from "../src/cluster.js";
import { criarAgenteSre } from "../src/sre.js";

const diag = {
  sintoma: "checkout fora do ar, 99% de erro 5xx",
  causa_provavel: "revisão 42 sem a variável DATABASE_URL",
  evidencias: ["ERROR variável obrigatória DATABASE_URL não definida", "deploy da revisão 42 às 09:12"],
  confianca: "alta",
  acao_proposta: "rollback para a revisão 41",
  prevencao: "validar configuração obrigatória no CI",
};

function investigacaoTipica() {
  return [
    [ferramenta("listar_pods", { deployment: "checkout" })],
    [ferramenta("descrever_deployment", { deployment: "checkout" }), ferramenta("ler_logs", { pod: "checkout-7f9c-a1", linhas: 20 })],
    [ferramenta("registrar_diagnostico", diag)],
    [ferramenta("fazer_rollback", { deployment: "checkout", revisao: 41 })],
    [texto("Rollback feito para a revisão 41.")],
  ];
}

test("investiga, registra diagnóstico e faz rollback COM aprovação", async () => {
  const cluster = new ClusterSimulado(carregarCenario("crashloop-config"));
  const { client } = modeloRoteirizado(investigacaoTipica());
  const r = await criarAgenteSre(client, cluster, { aprovar: async () => true }).investigar("checkout", "erro alto");
  assert.equal(r.motivo, "concluido");
  assert.equal(r.diagnostico?.confianca, "alta");
  assert.equal(cluster.c.deployment.revisaoAtual, 41);
  assert.ok(cluster.c.pods.every((p) => p.status === "Running"));
});

test("aprovação NEGADA: o cluster não muda", async () => {
  const cluster = new ClusterSimulado(carregarCenario("crashloop-config"));
  const { client } = modeloRoteirizado(investigacaoTipica());
  await criarAgenteSre(client, cluster, { aprovar: async () => false }).investigar("checkout", "erro alto");
  assert.equal(cluster.c.deployment.revisaoAtual, 42);
  assert.deepEqual(cluster.acoes, []);
});

test("não age sem diagnóstico registrado, mesmo com aprovação", async () => {
  const cluster = new ClusterSimulado(carregarCenario("crashloop-config"));
  const { client, requisicoes } = modeloRoteirizado([
    [ferramenta("fazer_rollback", { deployment: "checkout", revisao: 41 })],
    [texto("ok")],
  ]);
  await criarAgenteSre(client, cluster, { aprovar: async () => true }).investigar("checkout", "erro");
  assert.equal(cluster.c.deployment.revisaoAtual, 42);
  const resultado = JSON.stringify(requisicoes[1].messages.at(-1));
  assert.match(resultado, /Registre o diagnóstico antes de agir/);
});

test("diagnóstico sem evidência é recusado pelo schema", async () => {
  const cluster = new ClusterSimulado(carregarCenario("oom"));
  const { client, requisicoes } = modeloRoteirizado([[ferramenta("registrar_diagnostico", { ...diag, evidencias: [] })], [texto("ok")]]);
  const r = await criarAgenteSre(client, cluster).investigar("recomendacoes", "latência");
  assert.equal(r.diagnostico, null);
  assert.match(JSON.stringify(requisicoes[1].messages.at(-1)), /Argumentos inválidos: evidencias/);
});

test("ajuste de recursos valida o formato (2Gi sim, 2GB não)", async () => {
  const cluster = new ClusterSimulado(carregarCenario("oom"));
  const { client } = modeloRoteirizado([
    [ferramenta("registrar_diagnostico", diag)],
    [ferramenta("ajustar_recursos", { deployment: "recomendacoes", memoria: "2GB" })],
    [ferramenta("ajustar_recursos", { deployment: "recomendacoes", memoria: "2Gi" })],
    [texto("ok")],
  ]);
  await criarAgenteSre(client, cluster, { aprovar: async () => true }).investigar("recomendacoes", "OOM");
  assert.equal(cluster.c.deployment.recursos.memoria, "2Gi");
  assert.equal(cluster.acoes.length, 1);
});

test("cluster simulado: erros úteis para o agente se corrigir", () => {
  const cluster = new ClusterSimulado(carregarCenario("imagem-inexistente"));
  assert.throws(() => cluster.logs("frete-xyz", 10), /Pods: frete-6b8-k1, frete-5a1-old/);
  assert.throws(() => cluster.rollback("frete", 3), /não existe no histórico/);
  assert.throws(() => cluster.rollback("frete", 9), /já é a atual/);
  assert.throws(() => cluster.pods("pagamentos"), /Disponível: frete/);
});

test("todos os cenários são válidos e a ação correta é executável", () => {
  for (const arq of readdirSync(new URL("../cenarios/", import.meta.url))) {
    const c = carregarCenario(arq.replace(".json", ""));
    const cluster = new ClusterSimulado(c);
    const { ferramenta: f, args } = c.acaoCorreta;
    if (f === "fazer_rollback") cluster.rollback(String(args.deployment), Number(args.revisao));
    else cluster.ajustarRecursos(String(args.deployment), args.memoria as string);
    assert.equal(cluster.acoes.length, 1, arq);
  }
});
