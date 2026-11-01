/**
 * Prepara o índice de busca do Módulo 4 para o servidor MCP.
 * O servidor MCP é só uma "porta" nova para o mesmo RAG: nada do RAG é reescrito.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Banco } from "../../../modulo-04/projeto/src/banco.js";
import { dividirMarkdown } from "../../../modulo-04/projeto/src/chunking.js";
import { criarEmbedder, type Embedder } from "../../../modulo-04/projeto/src/embeddings.js";

const aqui = fileURLToPath(new URL(".", import.meta.url));
export const PASTA_M4 = resolve(aqui, "../../../modulo-04/projeto");
export const PASTA_DOCS = join(PASTA_M4, "docs");

export interface Indice {
  banco: Banco;
  embedder: Embedder;
  docs: Map<string, string>; // nome do documento → markdown
}

export function lerDocs(pasta = PASTA_DOCS): Map<string, string> {
  return new Map(
    readdirSync(pasta)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => [f.replace(/\.md$/, ""), readFileSync(join(pasta, f), "utf-8")]),
  );
}

/** Abre o índice criado com `npm run indexar` no projeto do Módulo 4. */
export async function abrirIndiceDoModulo4(caminho = process.env.RAG_BANCO ?? join(PASTA_M4, ".banco")): Promise<Indice> {
  if (!existsSync(caminho)) {
    throw new Error(`Índice não encontrado em ${caminho}. Rode "npm run indexar" no projeto do Módulo 4.`);
  }
  const banco = await Banco.abrir(caminho);
  const nome = await banco.embedderIndexado();
  if (!nome) throw new Error(`O banco em ${caminho} não tem índice. Rode "npm run indexar" no Módulo 4.`);
  return { banco, embedder: criarEmbedder(nome), docs: lerDocs() };
}

/** Cria um índice só em memória (usado nos testes, com o embedder de brinquedo). */
export async function criarIndiceEmMemoria(nomeEmbedder = "hash"): Promise<Indice> {
  const docs = lerDocs();
  const embedder = criarEmbedder(nomeEmbedder);
  const trechos = [...docs].flatMap(([nome, md]) => dividirMarkdown(`${nome}.md`, md));
  const banco = await Banco.abrir();
  await banco.criarTabela(embedder.dimensao, embedder.nome);
  await banco.inserir(trechos, await embedder.documentos(trechos.map((t) => t.textoIndexado)));
  return { banco, embedder, docs };
}
