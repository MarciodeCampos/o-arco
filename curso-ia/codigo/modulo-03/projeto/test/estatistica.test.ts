import assert from "node:assert/strict";
import { test } from "node:test";
import { bootstrapPorCaso, desvioPadrao, diferencaPareada, media, percentil, pisoDeRuido, wilson } from "../src/estatistica.js";

const perto = (a: number, b: number, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);

test("média, desvio e percentil", () => {
  perto(media([1, 2, 3, 4]), 2.5);
  perto(desvioPadrao([2, 4, 4, 4, 5, 5, 7, 9]), 2.138);
  perto(percentil([1, 2, 3, 4, 5], 0.5), 3);
  perto(percentil([1, 2, 3, 4], 0.95), 3.85);
});

test("Wilson: 8 de 10 → IC de ~49% a ~94%", () => {
  const r = wilson(8, 10);
  perto(r.taxa, 0.8);
  perto(r.inferior, 0.4902);
  perto(r.superior, 0.9433);
});

test("Wilson nunca sai de [0, 1], mesmo com 0% ou 100%", () => {
  const zero = wilson(0, 5);
  const cem = wilson(5, 5);
  assert.equal(zero.inferior, 0);
  assert.ok(zero.superior > 0 && zero.superior < 1);
  assert.equal(cem.superior, 1);
  assert.ok(cem.inferior > 0.5 && cem.inferior < 1);
});

test("diferença pareada: B melhor em todos os casos tem IC acima de zero", () => {
  const a = [0, 0.33, 0.67, 0.33, 0, 0.67, 0.33, 0, 0.33, 0.67];
  const b = a.map((x) => Math.min(1, x + 0.33));
  const d = diferencaPareada(a, b);
  assert.ok(d.inferior > 0);
});

test("diferença pareada: ruído puro tem IC que cruza zero", () => {
  const a = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1];
  const b = [0, 1, 1, 0, 1, 0, 1, 1, 0, 1];
  const d = diferencaPareada(a, b);
  assert.ok(d.inferior < 0 && d.superior > 0);
});

test("piso de ruído: depende dos casos, não das repetições (25 → ±20 p.p.; 100 → ±10 p.p.)", () => {
  perto(pisoDeRuido(25), 0.2);
  perto(pisoDeRuido(100), 0.1);
});

test("bootstrap por caso: IC contém a média e é reproduzível com a mesma semente", () => {
  const taxas = [1, 1, 0.67, 0, 1, 0.33, 1, 1, 0.67, 1, 0, 1];
  const r1 = bootstrapPorCaso(taxas);
  const r2 = bootstrapPorCaso(taxas);
  assert.ok(r1.inferior < r1.media && r1.media < r1.superior);
  assert.deepEqual(r1, r2);
});

test("bootstrap por caso: repetir os mesmos casos não estreita o intervalo", () => {
  // 20 casos, metade sempre acerta e metade sempre erra. Rodar 1 ou 10 vezes dá as
  // mesmas taxas por caso, então o intervalo tem de ser o mesmo.
  const taxas = Array.from({ length: 20 }, (_, i) => (i % 2 ? 1 : 0));
  const r = bootstrapPorCaso(taxas);
  assert.ok(r.superior - r.inferior > 0.3, "com 20 casos o IC deve ter mais de ±15 p.p.");
});
