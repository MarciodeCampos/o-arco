/**
 * Projeto do Módulo 2 — Extrator de recibos.
 *
 *   npm run extrair                         # processa recibos/*.txt
 *   npm run extrair -- --modelo claude-haiku-5-5
 *   npm run extrair -- --pasta outra/pasta
 *
 * Gera saida/<arquivo>.json e um relatório de qualidade e custo no terminal.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { custoChamada, somarUso } from "./custo.js";
import { extrairRecibo } from "./extrator.js";

const { values } = parseArgs({
  options: {
    modelo: { type: "string", default: "claude-opus-5-5" },
    pasta: { type: "string", default: "recibos" },
    saida: { type: "string", default: "saida" },
  },
});
const modelo = values.modelo!;

async function main() {
  const arquivos = readdirSync(values.pasta!).filter((f) => f.endsWith(".txt")).sort();
  if (arquivos.length === 0) throw new Error(`Nenhum .txt em ${values.pasta}`);
  mkdirSync(values.saida!, { recursive: true });

  const client = new Anthropic({ maxRetries: 3 });
  const linhas: string[] = [];
  const todosUsos = [];
  let custoTotal = 0;
  let aprovados = 0;

  console.log(`Extraindo ${arquivos.length} recibos com ${modelo}...\n`);

  for (const arquivo of arquivos) {
    const texto = readFileSync(join(values.pasta!, arquivo), "utf-8");
    const inicio = performance.now();
    const r = await extrairRecibo(client, texto, modelo);
    const segundos = (performance.now() - inicio) / 1000;
    const custo = r.usos.reduce((s, u) => s + custoChamada(u, modelo), 0);
    custoTotal += custo;
    todosUsos.push(...r.usos);
    if (r.problemas.length === 0) aprovados++;

    writeFileSync(
      join(values.saida!, basename(arquivo, ".txt") + ".json"),
      JSON.stringify({ arquivo, modelo, ...r, custo_usd: custo }, null, 2),
    );

    const status = r.problemas.length === 0 ? "✓ ok    " : "⚠ revisar";
    linhas.push(
      `${status} ${arquivo.padEnd(24)} total R$ ${(r.recibo?.total ?? 0).toFixed(2).padStart(8)}  ` +
        `confiança ${(r.recibo?.confianca ?? "-").padEnd(5)}  tentativas ${r.tentativas}  ${segundos.toFixed(1)}s  US$ ${custo.toFixed(5)}`,
    );
    for (const p of r.problemas) linhas.push(`           ↳ ${p}`);
  }

  const uso = somarUso(todosUsos);
  console.log(linhas.join("\n"));
  console.log("\n--- relatório ---");
  console.log(`aprovados sem revisão: ${aprovados}/${arquivos.length}`);
  console.log(`tokens: ${uso.input_tokens} entrada · ${uso.cache_read_input_tokens} lidos do cache · ${uso.output_tokens} saída`);
  console.log(`custo total: US$ ${custoTotal.toFixed(5)}  ·  por recibo: US$ ${(custoTotal / arquivos.length).toFixed(5)}`);
  console.log(`projeção para 10.000 recibos/mês: US$ ${((custoTotal / arquivos.length) * 10_000).toFixed(2)} (metade disso via batch)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
