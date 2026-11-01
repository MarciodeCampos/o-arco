/**
 * ChatOps no terminal: simula o comando "/investigar" de um canal de incidentes.
 * Num Slack ou Teams real, a aprovação seria um botão, e o aprovador precisaria ter
 * o papel certo (RBAC): quem pode aprovar rollback em produção não é qualquer um.
 *
 *   npm run investigar -- crashloop-config
 *   npm run investigar -- oom
 *   npm run investigar -- imagem-inexistente
 */
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import Anthropic from "@anthropic-ai/sdk";
import { ClusterSimulado, carregarCenario } from "./cluster.js";
import { criarAgenteSre } from "./sre.js";

const APROVADORES = new Set(["ana.sre", "bruno.oncall"]); // RBAC simplificado

async function main() {
  const nome = process.argv[2] ?? "crashloop-config";
  const cenario = carregarCenario(nome);
  const cluster = new ClusterSimulado(cenario);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const auditoria = (linha: object) => appendFileSync("auditoria-chatops.jsonl", JSON.stringify({ quando: new Date().toISOString(), ...linha }) + "\n");

  console.log(`#incidentes  🔔 alerta: taxa de erro alta em "${cenario.servico}"\n#incidentes  > /investigar ${cenario.servico}\n`);
  const sre = criarAgenteSre(new Anthropic(), cluster, {
    aoEvento: (e) => {
      if (e.tipo === "chamada") console.log(`  🔎 ${e.ferramenta}(${JSON.stringify(e.args)})`);
      if (e.tipo === "texto") console.log(`  🤖 ${e.texto}`);
      auditoria({ incidente: nome, evento: e });
    },
    aprovar: async ({ ferramenta, args }) => {
      console.log(`\n  ⚠ Ação proposta: ${ferramenta} ${JSON.stringify(args)}`);
      const quem = (await rl.question("  Quem aprova? (usuário, ou vazio para negar) ")).trim();
      const ok = APROVADORES.has(quem) && (await rl.question(`  ${quem}, confirma? [s/N] `)).trim().toLowerCase() === "s";
      if (quem && !APROVADORES.has(quem)) console.log(`  ⛔ ${quem} não tem permissão para aprovar ações em produção.`);
      auditoria({ incidente: nome, aprovacao: { ferramenta, args, quem: quem || null, aprovada: ok } });
      return ok;
    },
  });

  const r = await sre.investigar(cenario.servico, "taxa de erro 5xx acima de 5% por 5 minutos");
  if (r.diagnostico) {
    const d = r.diagnostico;
    console.log(`\n📋 Diagnóstico (${d.confianca})\n  sintoma: ${d.sintoma}\n  causa: ${d.causa_provavel}\n  evidências:\n${d.evidencias.map((e) => `    - ${e}`).join("\n")}\n  ação: ${d.acao_proposta}\n  prevenção: ${d.prevencao}`);
  }
  console.log(`\nAções executadas no cluster: ${cluster.acoes.map((a) => a.detalhe).join("; ") || "nenhuma"}`);
  console.log(`[${r.motivo} · ${r.passos} passos · US$ ${r.custoUsd.toFixed(4)} · auditoria em auditoria-chatops.jsonl]`);
  rl.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
