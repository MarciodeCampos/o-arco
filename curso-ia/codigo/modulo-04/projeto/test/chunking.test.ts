import assert from "node:assert/strict";
import { test } from "node:test";
import { dividirMarkdown, quebrarPorParagrafos, slug } from "../src/chunking.js";

const md = `# Manual do Teste

> nota que não deve virar trecho

## 1. Instalação

Ligue na tomada.

## Garantia e Devoluções

Doze meses.
`;

test("um trecho por seção, com ids estáveis e legíveis", () => {
  const t = dividirMarkdown("manual-teste.md", md);
  assert.deepEqual(t.map((x) => x.id), ["manual-teste#1-instalacao", "manual-teste#garantia-e-devolucoes"]);
  assert.equal(t[0].tituloDoc, "Manual do Teste");
  assert.equal(t[0].texto, "Ligue na tomada.");
});

test("o texto indexado leva o cabeçalho de contexto; o texto exibido não", () => {
  const [t] = dividirMarkdown("m.md", md);
  assert.match(t.textoIndexado, /^Manual do Teste — 1\. Instalação/);
  assert.ok(!t.texto.includes("Manual do Teste"));
});

test("título do documento e citações (>) não viram trecho", () => {
  const t = dividirMarkdown("m.md", md);
  assert.ok(t.every((x) => !x.texto.includes("nota que não deve")));
});

test("seção longa é dividida por parágrafos, com sobreposição", () => {
  const paragrafos = Array.from({ length: 6 }, (_, i) => `Parágrafo ${i} ` + "x".repeat(80));
  const pedacos = quebrarPorParagrafos(paragrafos.join("\n\n"), 200, 1);
  assert.ok(pedacos.length > 1);
  assert.ok(pedacos.every((p) => p.length <= 200 + 100));
  // o último parágrafo de um pedaço reaparece no começo do próximo
  const ultimoDoPrimeiro = pedacos[0].split("\n\n").at(-1)!;
  assert.ok(pedacos[1].startsWith(ultimoDoPrimeiro));
});

test("ids de seções divididas ganham sufixo", () => {
  const longo = `# D\n\n## Seção\n\n${Array.from({ length: 5 }, () => "y".repeat(300)).join("\n\n")}`;
  const ids = dividirMarkdown("d.md", longo, { maxCaracteres: 400 }).map((t) => t.id);
  assert.equal(ids[0], "d#secao");
  assert.equal(ids[1], "d#secao-2");
});

test("slug remove acentos e pontuação", () => {
  assert.equal(slug("Troca por defeito nos primeiros 30 dias!"), "troca-por-defeito-nos-primeiros-30-dias");
  assert.equal(slug("Retenção"), "retencao");
});
