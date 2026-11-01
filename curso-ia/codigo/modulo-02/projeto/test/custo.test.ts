import assert from "node:assert/strict";
import { test } from "node:test";
import { custoChamada, somarUso } from "../src/custo.js";

const perto = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("custo simples: entrada + saída", () => {
  // 1M de entrada a $4 + 100k de saída a $20 = 4 + 2
  perto(custoChamada({ input_tokens: 1_000_000, output_tokens: 100_000 }, "claude-opus-5-5"), 6);
});

test("leitura de cache é muito mais barata que entrada normal", () => {
  const normal = custoChamada({ input_tokens: 10_000, output_tokens: 0 }, "claude-opus-5-5");
  const cache = custoChamada({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 10_000 }, "claude-opus-5-5");
  perto(normal, 0.04);
  perto(cache, 0.002);
});

test("escrita no cache custa 1,25× a entrada", () => {
  perto(custoChamada({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000 }, "claude-opus-5-5"), 5);
});

test("batch custa metade", () => {
  const u = { input_tokens: 2_000_000, output_tokens: 500_000 };
  perto(custoChamada(u, "claude-haiku-5-5", { batch: true }), custoChamada(u, "claude-haiku-5-5") / 2);
});

test("modelo sem preço gera erro explícito", () => {
  assert.throws(() => custoChamada({ input_tokens: 1, output_tokens: 1 }, "modelo-x"), /Sem preço/);
});

test("somarUso trata campos ausentes como zero", () => {
  assert.deepEqual(
    somarUso([
      { input_tokens: 10, output_tokens: 5 },
      { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 100, cache_creation_input_tokens: null },
    ]),
    { input_tokens: 11, output_tokens: 7, cache_creation_input_tokens: 0, cache_read_input_tokens: 100 },
  );
});
