import assert from "node:assert/strict";
import { test } from "node:test";
import { acertoEmK, ndcgEmK, recallEmK, rr } from "../src/metricas.js";

const perto = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test("recall@k conta a fração dos relevantes no topo", () => {
  perto(recallEmK(["a", "b", "c"], ["a", "c"], 3), 1);
  perto(recallEmK(["a", "b", "c"], ["a", "c"], 2), 0.5);
  perto(recallEmK(["x", "y"], ["a"], 2), 0);
});

test("acerto@k: pelo menos um relevante no topo", () => {
  assert.equal(acertoEmK(["x", "a"], ["a", "b"], 2), 1);
  assert.equal(acertoEmK(["x", "a"], ["a", "b"], 1), 0);
});

test("reciprocal rank", () => {
  perto(rr(["a", "b"], ["a"]), 1);
  perto(rr(["x", "y", "a"], ["a"]), 1 / 3);
  perto(rr(["x"], ["a"]), 0);
});

test("nDCG: relevante no topo vale mais que relevante no fim", () => {
  perto(ndcgEmK(["a", "x", "y"], ["a"], 3), 1);
  assert.ok(ndcgEmK(["x", "y", "a"], ["a"], 3) < ndcgEmK(["x", "a", "y"], ["a"], 3));
  perto(ndcgEmK(["x", "y"], ["a"], 2), 0);
});
