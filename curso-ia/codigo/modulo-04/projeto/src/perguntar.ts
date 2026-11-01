/**
 * Pergunte à documentação.
 *
 *   npm run perguntar -- "Quanto tempo leva para chegar no interior de MG?"
 *   npm run perguntar -- --modo vetorial "..."
 *   npm run perguntar -- --rerank "..."
 *   npm run perguntar -- --contexto-completo "..."   # sem RAG: manda TODOS os documentos
 *   npm run perguntar -- --so-busca "..."            # mostra só os trechos (não chama o LLM)
 */
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { Banco } from "./banco.js";
import { MODELO_RERANK, buscar, reordenar, type Modo } from "./busca.js";
import { criarEmbedder } from "./embeddings.js";
import { MODELO, responder } from "./resposta.js";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    modo: { type: "string", default: "hibrida" },
    k: { type: "string", default: "5" },
    rerank: { type: "boolean", default: false },
    "contexto-completo": { type: "boolean", default: false },
    "so-busca": { type: "boolean", default: false },
    banco: { type: "string", default: ".banco" },
  },
});

async function main() {
  const pergunta = positionals.join(" ");
  if (!pergunta) throw new Error('uso: npm run perguntar -- "sua pergunta"');
  const banco = await Banco.abrir(args.banco);
  const nomeEmbedder = await banco.embedderIndexado();
  if (!nomeEmbedder) throw new Error("Índice não encontrado. Rode npm run indexar primeiro.");
  const embedder = criarEmbedder(nomeEmbedder);
  const k = Number(args.k);

  let trechos;
  if (args["contexto-completo"]) {
    trechos = await banco.todos();
    console.log(`(contexto completo: ${trechos.length} trechos, sem busca)\n`);
  } else {
    const candidatos = await buscar(banco, embedder, pergunta, args.modo as Modo, args.rerank ? k * 4 : k);
    if (args.rerank) {
      const client = new Anthropic();
      const r = await reordenar(client, pergunta, candidatos, k);
      trechos = r.resultados;
      console.log(`(reranking com ${MODELO_RERANK}: ${r.uso.input_tokens} tokens de entrada)`);
    } else {
      trechos = candidatos;
    }
    console.log(`Trechos recuperados (${args.modo}${args.rerank ? " + rerank" : ""}, embedder ${nomeEmbedder}):`);
    trechos.forEach((t, i) => console.log(`  ${i + 1}. ${t.id}  (${Number(t.pontuacao).toFixed(3)})`));
    console.log();
  }
  await banco.fechar();
  if (args["so-busca"]) return;

  const client = new Anthropic();
  const r = await responder(client, pergunta, trechos);
  console.log(r.texto);
  if (r.citacoes.length) {
    console.log("\nFontes:");
    const vistas = new Set<string>();
    for (const c of r.citacoes) {
      if (vistas.has(c.fonte + c.trecho)) continue;
      vistas.add(c.fonte + c.trecho);
      console.log(`  [${c.fonte}] "${c.trecho.replace(/\s+/g, " ").slice(0, 110)}"`);
    }
  }
  console.log(`\n[${MODELO} · ${r.uso.input_tokens} tokens de entrada · ${r.uso.output_tokens} de saída]`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
