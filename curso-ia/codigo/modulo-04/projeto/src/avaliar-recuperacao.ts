/**
 * Eval de RECUPERAÇÃO: a busca traz os trechos certos? Não chama LLM (exceto com --rerank).
 *
 *   npm run avaliar:busca
 *   npm run avaliar:busca -- --k 3
 *   npm run avaliar:busca -- --rerank
 *
 * Use o índice já criado (npm run indexar). Compare embedders reindexando com outro.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { Banco } from "./banco.js";
import { buscar, reordenar, type Modo } from "./busca.js";
import { criarEmbedder } from "./embeddings.js";
import { acertoEmK, ndcgEmK, recallEmK, rr } from "./metricas.js";

interface Pergunta {
  id: string;
  pergunta: string;
  relevantes: string[];
  tags: string[];
}

const { values: args } = parseArgs({
  options: {
    k: { type: "string", default: "5" },
    rerank: { type: "boolean", default: false },
    banco: { type: "string", default: ".banco" },
    perguntas: { type: "string", default: "avaliacao/perguntas.jsonl" },
    detalhes: { type: "boolean", default: false },
  },
});

async function main() {
  const k = Number(args.k);
  const perguntas: Pergunta[] = readFileSync(args.perguntas!, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
    .filter((p: Pergunta) => p.relevantes.length > 0); // as sem resposta são avaliadas no eval de respostas

  const banco = await Banco.abrir(args.banco);
  const nomeEmbedder = await banco.embedderIndexado();
  if (!nomeEmbedder) throw new Error("Índice não encontrado. Rode npm run indexar primeiro.");
  const embedder = criarEmbedder(nomeEmbedder);
  const client = args.rerank ? new Anthropic() : null;

  const modos: (Modo | "hibrida+rerank")[] = ["textual", "vetorial", "hibrida", ...(args.rerank ? (["hibrida+rerank"] as const) : [])];
  console.log(`${perguntas.length} perguntas · k = ${k} · embedder ${nomeEmbedder}\n`);
  console.log(`${"modo".padEnd(16)} ${"acerto@k".padStart(9)} ${"recall@k".padStart(9)} ${"MRR".padStart(6)} ${"nDCG@k".padStart(7)}`);

  for (const modo of modos) {
    const m = { acerto: 0, recall: 0, mrr: 0, ndcg: 0 };
    const falhas: string[] = [];
    for (const p of perguntas) {
      let ids: string[];
      if (modo === "hibrida+rerank") {
        const candidatos = await buscar(banco, embedder, p.pergunta, "hibrida", 20);
        ids = (await reordenar(client!, p.pergunta, candidatos, k)).resultados.map((r) => r.id);
      } else {
        ids = (await buscar(banco, embedder, p.pergunta, modo, k)).map((r) => r.id);
      }
      m.acerto += acertoEmK(ids, p.relevantes, k);
      m.recall += recallEmK(ids, p.relevantes, k);
      m.mrr += rr(ids, p.relevantes);
      m.ndcg += ndcgEmK(ids, p.relevantes, k);
      if (!acertoEmK(ids, p.relevantes, k)) falhas.push(`${p.id}: "${p.pergunta}" → ${ids.slice(0, 3).join(", ") || "(nada)"}`);
    }
    const n = perguntas.length;
    const f = (x: number) => (x / n).toFixed(2);
    console.log(`${modo.padEnd(16)} ${f(m.acerto).padStart(9)} ${f(m.recall).padStart(9)} ${f(m.mrr).padStart(6)} ${f(m.ndcg).padStart(7)}`);
    if (args.detalhes && falhas.length) console.log(falhas.map((x) => `    ✗ ${x}`).join("\n"));
  }
  await banco.fechar();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
