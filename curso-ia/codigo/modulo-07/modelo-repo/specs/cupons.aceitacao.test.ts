/**
 * Testes de aceitação da spec de cupons. Ficam FORA de test/ de propósito:
 * o exercício é pedir a um agente que implemente src/cupons.ts a partir da spec
 * até estes testes passarem (npm run aceitacao), sem alterá-los.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-ignore — o módulo ainda não existe; o agente vai criá-lo
import { aplicarCupom } from "../src/cupons.js";

const pedido = { subtotal: 20000, frete: 2500 };
const hoje = "2026-11-01";

test("percentual: 10% do subtotal, sem tocar no frete", () => {
  assert.deepEqual(aplicarCupom({ codigo: "DEZ", tipo: "percentual", valor: 10 }, pedido, hoje), { desconto: 2000, frete: 2500, total: 20500 });
});

test("percentual arredonda ao centavo", () => {
  const r = aplicarCupom({ codigo: "X", tipo: "percentual", valor: 15 }, { subtotal: 1003, frete: 0 }, hoje);
  assert.equal(r.desconto, 150); // 150,45 → 150
});

test("valor fixo limitado ao subtotal", () => {
  const r = aplicarCupom({ codigo: "CEM", tipo: "valor_fixo", valor: 10000 }, { subtotal: 6000, frete: 1500 }, hoje);
  assert.deepEqual(r, { desconto: 6000, frete: 1500, total: 1500 });
});

test("frete grátis zera só o frete", () => {
  assert.deepEqual(aplicarCupom({ codigo: "FRETE", tipo: "frete_gratis", valor: 0 }, pedido, hoje), { desconto: 0, frete: 0, total: 20000 });
});

test("pedido mínimo: recusa com valor formatado", () => {
  assert.throws(
    () => aplicarCupom({ codigo: "MIN", tipo: "percentual", valor: 5, minimoPedido: 25000 }, pedido, hoje),
    /Cupom MIN exige pedido mínimo de R\$ 250,00/,
  );
});

test("validade: vale no último dia, expira no seguinte", () => {
  const cupom = { codigo: "NOV", tipo: "percentual" as const, valor: 10, validoAte: "2026-11-01" };
  assert.equal(aplicarCupom(cupom, pedido, "2026-11-01").desconto, 2000);
  assert.throws(() => aplicarCupom(cupom, pedido, "2026-11-02"), /Cupom NOV expirou em 2026-11-01/);
});
