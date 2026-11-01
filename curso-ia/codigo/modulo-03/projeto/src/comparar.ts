/**
 * Compara duas execuções de eval nos MESMOS casos.
 *
 *   npm run comparar -- resultados/A.json resultados/B.json
 *
 * Responde: B é melhor, pior ou igual a A, considerando o ruído? E quanto custa?
 */
import { readFileSync } from "node:fs";
import { bootstrapPorCaso, diferencaPareada, media, percentil } from "./estatistica.js";
import type { Linha } from "./tipos.js";

interface Execucao {
  meta: { modelo: string; reps: number };
  linhas: Linha[];
}

const [arqA, arqB] = process.argv.slice(2);
if (!arqA || !arqB) {
  console.error("uso: npm run comparar -- <resultado-A.json> <resultado-B.json>");
  process.exit(1);
}
const A: Execucao = JSON.parse(readFileSync(arqA, "utf-8"));
const B: Execucao = JSON.parse(readFileSync(arqB, "utf-8"));

/** Taxa de acerto por caso (média das repetições). */
function porCaso(e: Execucao): Map<string, number> {
  const grupos = new Map<string, number[]>();
  for (const l of e.linhas) grupos.set(l.caso, [...(grupos.get(l.caso) ?? []), l.passou ? 1 : 0]);
  return new Map([...grupos].map(([k, v]) => [k, media(v)]));
}

const pa = porCaso(A);
const pb = porCaso(B);
const comuns = [...pa.keys()].filter((k) => pb.has(k)).sort();
const soEmUm = [...new Set([...pa.keys(), ...pb.keys()])].filter((k) => !comuns.includes(k));

const nomeA = `A (${A.meta.modelo})`;
const nomeB = `B (${B.meta.modelo})`;
console.log(`${"caso".padEnd(32)} ${nomeA.padStart(22)} ${nomeB.padStart(22)}`);
for (const c of comuns) {
  const a = pa.get(c)!;
  const b = pb.get(c)!;
  const marca = b > a ? "  ▲" : b < a ? "  ▼" : "";
  console.log(`${c.padEnd(32)} ${`${(a * 100).toFixed(0)}%`.padStart(22)} ${`${(b * 100).toFixed(0)}%`.padStart(22)}${marca}`);
}
if (soEmUm.length) console.log(`\n(ignorados por não estarem nos dois: ${soEmUm.join(", ")})`);

const d = diferencaPareada(
  comuns.map((c) => pa.get(c)!),
  comuns.map((c) => pb.get(c)!),
);
const pp = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)} p.p.`;
console.log(`\nDiferença B − A: ${pp(d.media)}  (IC 95%: ${pp(d.inferior)} a ${pp(d.superior)})`);
// Conferência sem supor normalidade: reamostra os casos, levando a diferença de cada um.
const boot = bootstrapPorCaso(comuns.map((c) => pb.get(c)! - pa.get(c)!));
console.log(`Conferência por reamostragem de casos: IC 95% ${pp(boot.inferior)} a ${pp(boot.superior)}`);
if (d.inferior > 0) console.log("→ B é melhor, com evidência razoável.");
else if (d.superior < 0) console.log("→ B é pior, com evidência razoável.");
else console.log("→ Inconclusivo: a diferença cabe no ruído. Mais casos independentes ajudariam; repetições só reduzem a variação dentro de cada caso.");

const custo = (e: Execucao) => media(e.linhas.map((l) => l.custoUsd));
const p50 = (e: Execucao) => percentil(e.linhas.map((l) => l.latenciaS), 0.5);
console.log(`\nCusto por execução: A US$ ${custo(A).toFixed(5)} · B US$ ${custo(B).toFixed(5)} (B/A = ${(custo(B) / custo(A)).toFixed(2)}×)`);
console.log(`Latência p50:       A ${p50(A).toFixed(1)}s · B ${p50(B).toFixed(1)}s`);
