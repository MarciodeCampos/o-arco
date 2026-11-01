/**
 * Eval de agentes com a API real: roda cada cenário e avalia a trajetória.
 *
 *   npm run avaliar
 *   npm run avaliar -- --reps 3
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { avaliarTrajetoria, type Cenario } from "./avaliar-trajetoria.js";
import { montarAtendimento } from "./montagem.js";

const { values } = parseArgs({ options: { reps: { type: "string", default: "1" }, cenarios: { type: "string", default: "cenarios.jsonl" } } });

async function main() {
  const cenarios: Cenario[] = readFileSync(values.cenarios!, "utf-8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  const client = new Anthropic({ maxRetries: 4 });
  let ok = 0;
  let total = 0;
  let custo = 0;
  for (const c of cenarios) {
    for (let rep = 0; rep < Number(values.reps); rep++) {
      // Sistema novo a cada execução: estado limpo, sem vazamento entre casos.
      const { supervisor } = montarAtendimento(client, {
        cliente: "ana@exemplo.com",
        aprovar: async () => c.aprovacao === "aprovar",
      });
      const r = await supervisor.atender(c.tarefa);
      custo += r.custoUsd;
      const checks = avaliarTrajetoria(c, r);
      const passou = checks.every((x) => x.passou);
      total++;
      if (passou) ok++;
      console.log(`${passou ? "✓" : "✗"} ${c.id} (rep ${rep}) · ${r.especialista} · ${r.passos} passos · US$ ${r.custoUsd.toFixed(4)}`);
      for (const x of checks.filter((x) => !x.passou)) console.log(`    ✗ ${x.nome}: ${x.detalhe}`);
    }
  }
  console.log(`\n${ok}/${total} cenários aprovados · custo total US$ ${custo.toFixed(4)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
