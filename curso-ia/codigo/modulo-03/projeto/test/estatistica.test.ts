import assert from "node:assert/strict";
import { test } from "node:test";
import { desvioPadrao, diferencaPareada, media, percentil, pisoDeRuido, wilson } from "../src/estatistica.js";

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

test("piso de ruído: 25 casos × 2 reps ≈ ±14 p.p.; 100 × 2 ≈ ±7 p.p.", () => {
  perto(pisoDeRuido(25, 2), 0.1414);
  perto(pisoDeRuido(100, 2), 0.0707);
});
