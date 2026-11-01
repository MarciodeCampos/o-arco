/**
 * Teste de integração: Postgres (PGlite em memória) + pgvector + busca textual,
 * com o embedder de brinquedo. Roda offline, sem chave de API.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { Banco, type Resultado } from "../src/banco.js";
import { rrf, buscar } from "../src/busca.js";
import { dividirMarkdown } from "../src/chunking.js";
import { EmbedderHash, cosseno } from "../src/embeddings.js";

const docs = new URL("../docs/", import.meta.url);
const embedder = new EmbedderHash();
let banco: Banco;

before(async () => {
  const trechos = readdirSync(docs)
    .filter((f) => f.endsWith(".md"))
    .flatMap((f) => dividirMarkdown(f, readFileSync(new URL(f, docs), "utf-8")));
  banco = await Banco.abrir();
  await banco.criarTabela(embedder.dimensao, embedder.nome);
  await banco.inserir(trechos, await embedder.documentos(trechos.map((t) => t.textoIndexado)));
});
after(async () => banco.fechar());

test("o embedder de brinquedo é determinístico e normalizado", async () => {
  const [a] = await embedder.documentos(["frete grátis"]);
  const b = await embedder.consulta("frete grátis");
  assert.deepEqual(a, b);
  assert.ok(Math.abs(cosseno(a, a) - 1) < 1e-9);
});

test("busca textual encontra pelo radical em português", async () => {
  const r = await banco.buscarTextual("fretes gratuitos", 3);
  assert.equal(r[0]?.id, "entregas#frete-gratis");
});

test("busca vetorial devolve k resultados ordenados por similaridade", async () => {
  const r = await banco.buscarVetorial(await embedder.consulta("pausar a assinatura durante viagem"), 5);
  assert.equal(r.length, 5);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].pontuacao >= r[i].pontuacao);
});

test("busca híbrida combina os dois métodos", async () => {
  const r = await buscar(banco, embedder, "Quanto custa a assinatura de filtros por mês?", "hibrida", 5);
  assert.ok(r.some((x) => x.id === "plano-filtro-em-dia#preco-e-pagamento"));
});

test("textual não encontra nada com vocabulário totalmente diferente (sinônimos)", async () => {
  // "trazer de volta ao padrão de fábrica" não compartilha radicais com "resetar"/"restaurar".
  const r = await banco.buscarTextual("zerar tudo deixando como saiu da fábrica", 5);
  assert.ok(!r.slice(0, 1).some((x) => x.id === "manual-brisa-x2#8-resetar-o-aparelho"));
});

test("RRF: quem aparece nas duas listas fica à frente de quem aparece em uma só", () => {
  const item = (id: string): Resultado => ({ id, doc: "", tituloDoc: "", secao: "", texto: "", pontuacao: 0 });
  const fundida = rrf([
    [item("a"), item("b"), item("c")],
    [item("c"), item("b"), item("d")],
  ]);
  // "a" é 1º numa lista mas não aparece na outra; "b" e "c" aparecem nas duas.
  assert.deepEqual(new Set(fundida.slice(0, 2).map((x) => x.id)), new Set(["b", "c"]));
  assert.deepEqual(new Set(fundida.map((x) => x.id)), new Set(["a", "b", "c", "d"]));
});
