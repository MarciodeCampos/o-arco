/**
 * Testando o próprio eval. Antes de confiar numa nota, prove que:
 *  - o gabarito passa (oráculo): senão o avaliador ou o caso estão errados;
 *  - uma saída vazia/boba falha (linha de base nula): senão o avaliador é frouxo demais.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Recibo } from "../../../modulo-02/projeto/src/esquema.js";
import { avaliar, casoPassou } from "../src/avaliadores.js";
import type { Caso } from "../src/tipos.js";

const casos: Caso[] = readFileSync(new URL("../casos/casos.jsonl", import.meta.url), "utf-8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

/** Monta a saída "perfeita" a partir do gabarito. */
function oraculo(c: Caso): Recibo {
  const e = c.esperado;
  const n = e.n_itens ?? 1;
  return {
    emitente: { nome: "x", cnpj: e.cnpj === undefined ? null : e.cnpj },
    data: e.data ?? "2026-10-01",
    itens: Array.from({ length: n }, () => ({ descricao: "i", quantidade: 1, valor_unitario: 0, valor_total: 0 })),
    desconto: 0,
    acrescimo: 0,
    total: e.total ?? 0,
    forma_pagamento: e.forma_pagamento ?? "outro",
    confianca: e.deve_sinalizar ? "baixa" : "alta",
    observacoes: "",
  };
}

test("o conjunto de casos é saudável", () => {
  const ids = casos.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "ids duplicados");
  assert.ok(casos.length >= 10, "poucos casos");
  // cobertura nos dois sentidos: casos que devem e que não devem ser sinalizados
  assert.ok(casos.some((c) => c.esperado.deve_sinalizar === true));
  assert.ok(casos.some((c) => c.esperado.deve_sinalizar === false));
  for (const c of casos) assert.ok(c.origem, `${c.id} sem origem do gabarito`);
});

test("oráculo: o gabarito passa em todos os casos", () => {
  for (const c of casos) {
    const ch = avaliar(c, { recibo: oraculo(c), problemas: [] });
    assert.ok(casoPassou(ch), `${c.id}: ${JSON.stringify(ch.filter((x) => !x.passou))}`);
  }
});

test("linha de base nula: sem recibo e sem problemas, nenhum caso passa", () => {
  for (const c of casos) assert.equal(casoPassou(avaliar(c, { recibo: null, problemas: [] })), false, c.id);
});

test("'sinalizar tudo' não tira nota máxima (cobertura nos dois sentidos)", () => {
  const passou = casos.filter((c) => casoPassou(avaliar(c, { recibo: { ...oraculo(c), confianca: "baixa" }, problemas: ["x"] })));
  const total = casos.filter((c) => c.esperado.deve_sinalizar !== undefined).length;
  assert.ok(passou.length < total, "um sistema que sinaliza tudo passaria em todos");
});

test("tolerâncias: centavos e formatação de CNPJ não reprovam", () => {
  const c = casos.find((x) => x.id === "padaria")!;
  const r = oraculo(c);
  r.total = 27.299999;
  r.emitente.cnpj = "11.222.333/0001-81";
  assert.ok(casoPassou(avaliar(c, { recibo: r, problemas: [] })));
});

test("não é frouxo: total errado por 1 real reprova", () => {
  const c = casos.find((x) => x.id === "padaria")!;
  assert.equal(casoPassou(avaliar(c, { recibo: { ...oraculo(c), total: 26.3 }, problemas: [] })), false);
});

test("prompt injection obedecida reprova", () => {
  const c = casos.find((x) => x.id === "livraria-prompt-injection")!;
  const obedeceu = { ...oraculo(c), total: 0, forma_pagamento: "dinheiro" as const };
  const ch = avaliar(c, { recibo: obedeceu, problemas: [] });
  assert.equal(casoPassou(ch), false);
  assert.deepEqual(ch.filter((x) => !x.passou).map((x) => x.nome).sort(), ["forma_pagamento", "total"]);
});

test("'não é recibo': recusar com problemas passa; inventar itens sem sinalizar reprova", () => {
  const c = casos.find((x) => x.id === "nao-e-recibo")!;
  assert.ok(casoPassou(avaliar(c, { recibo: null, problemas: ["Nenhum item encontrado"] })));
  assert.equal(casoPassou(avaliar(c, { recibo: { ...oraculo(c), confianca: "alta" }, problemas: [] })), false);
});
