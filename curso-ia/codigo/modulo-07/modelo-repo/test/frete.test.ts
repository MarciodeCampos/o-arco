import assert from "node:assert/strict";
import { test } from "node:test";
import { centavos, formatar, percentual } from "../src/dinheiro.js";
import { cotarFrete } from "../src/frete.js";

test("frete para SP capital, 2,1 kg cobra 3 kg", () => {
  assert.deepEqual(cotarFrete("01310-100", 2.1), { regiao: "SP capital", valor: 1800 + 3 * 650, prazoDiasUteis: 2 });
});

test("frete aceita CEP com ou sem hífen", () => {
  assert.deepEqual(cotarFrete("30140071", 1), cotarFrete("30140-071", 1));
});

test("CEP e peso inválidos geram erro claro", () => {
  assert.throws(() => cotarFrete("123", 1), /CEP inválido/);
  assert.throws(() => cotarFrete("01310-100", 0), /Peso inválido/);
  assert.throws(() => cotarFrete("01310-100", 31), /Peso inválido/);
});

test("dinheiro: centavos inteiros, formatação brasileira e percentual arredondado", () => {
  assert.equal(centavos(0.1) + centavos(0.2), centavos(0.3)); // em ponto flutuante, 0.1 + 0.2 !== 0.3
  assert.equal(formatar(123456), "R$ 1.234,56");
  assert.equal(formatar(-5), "-R$ 0,05");
  assert.equal(percentual(12990, 10), 1299);
  assert.equal(percentual(1005, 10), 101); // 100,5 centavos → 101
});
