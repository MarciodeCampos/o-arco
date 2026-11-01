import assert from "node:assert/strict";
import { test } from "node:test";
import type { Recibo } from "../src/esquema.js";
import { cnpjValido, validarRecibo } from "../src/validar.js";

const base: Recibo = {
  emitente: { nome: "Padaria", cnpj: "11222333000181" },
  data: "2026-10-14",
  itens: [
    { descricao: "Bolo", quantidade: 2, valor_unitario: 7.9, valor_total: 15.8 },
    { descricao: "Café", quantidade: 1, valor_unitario: 6.5, valor_total: 6.5 },
  ],
  desconto: 0,
  acrescimo: 0,
  total: 22.3,
  forma_pagamento: "pix",
  confianca: "alta",
  observacoes: "",
};
const hoje = new Date("2026-11-01T12:00:00");

test("CNPJ: aceita válidos, com ou sem pontuação", () => {
  assert.equal(cnpjValido("11.222.333/0001-81"), true);
  assert.equal(cnpjValido("45678912000155"), true);
});

test("CNPJ: rejeita dígito errado, tamanho errado e repetidos", () => {
  assert.equal(cnpjValido("11.222.333/0001-82"), false);
  assert.equal(cnpjValido("123"), false);
  assert.equal(cnpjValido("00000000000000"), false);
});

test("recibo consistente não tem problemas", () => {
  assert.deepEqual(validarRecibo(base, hoje), []);
});

test("detecta soma que não fecha", () => {
  const erros = validarRecibo({ ...base, total: 30 }, hoje);
  assert.equal(erros.length, 1);
  assert.match(erros[0], /Soma não fecha/);
});

test("considera desconto e acréscimo", () => {
  assert.deepEqual(validarRecibo({ ...base, desconto: 2.3, acrescimo: 5, total: 25 }, hoje), []);
});

test("detecta item com quantidade × unitário errado", () => {
  const itens = [{ descricao: "Bolo", quantidade: 3, valor_unitario: 7.9, valor_total: 15.8 }, base.itens[1]];
  const erros = validarRecibo({ ...base, itens }, hoje);
  assert.ok(erros.some((e) => e.includes('Item "Bolo"')));
});

test("detecta data futura e data mal formatada", () => {
  assert.ok(validarRecibo({ ...base, data: "2027-01-01" }, hoje).some((e) => e.includes("futuro")));
  assert.ok(validarRecibo({ ...base, data: "14/10/2026" }, hoje).some((e) => e.includes("formato")));
});

test("CNPJ ausente (null) é aceito", () => {
  assert.deepEqual(validarRecibo({ ...base, emitente: { nome: "Feira", cnpj: null } }, hoje), []);
});
