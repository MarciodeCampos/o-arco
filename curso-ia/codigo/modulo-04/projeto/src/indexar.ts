/**
 * Ingestão: lê docs/*.md, divide em trechos, gera embeddings e grava no banco.
 *
 *   npm run indexar                      # embedder local (padrão)
 *   npm run indexar -- --embedder hash   # offline, sem baixar modelo
 *   npm run indexar -- --embedder voyage # precisa de VOYAGE_API_KEY
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Banco } from "./banco.js";
import { dividirMarkdown } from "./chunking.js";
import { criarEmbedder } from "./embeddings.js";

const { values: args } = parseArgs({
  options: {
    embedder: { type: "string", default: "local" },
    docs: { type: "string", default: "docs" },
    banco: { type: "string", default: ".banco" },
    max: { type: "string", default: "1200" },
  },
});

async function main() {
  const embedder = criarEmbedder(args.embedder!);
  const arquivos = readdirSync(args.docs!).filter((f) => f.endsWith(".md")).sort();
  const trechos = arquivos.flatMap((f) =>
    dividirMarkdown(f, readFileSync(join(args.docs!, f), "utf-8"), { maxCaracteres: Number(args.max) }),
  );
  console.log(`${arquivos.length} documentos → ${trechos.length} trechos`);
  const tamanhos = trechos.map((t) => t.texto.length).sort((a, b) => a - b);
  console.log(`tamanho dos trechos: mín ${tamanhos[0]} · mediana ${tamanhos[tamanhos.length >> 1]} · máx ${tamanhos.at(-1)} caracteres`);

  const inicio = performance.now();
  const embeddings = await embedder.documentos(trechos.map((t) => t.textoIndexado));
  console.log(`embeddings (${embedder.nome}, ${embedder.dimensao} dimensões) em ${((performance.now() - inicio) / 1000).toFixed(1)}s`);

  const banco = await Banco.abrir(args.banco);
  await banco.criarTabela(embedder.dimensao, embedder.nome);
  await banco.inserir(trechos, embeddings);
  await banco.fechar();
  console.log(`índice salvo em ${args.banco}/`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
