/**
 * Lab 1.3 — A mesma rede neural do XOR, em TypeScript puro (sem bibliotecas).
 *
 * Objetivo: ver que não há mágica. Uma rede neural é multiplicação de
 * matrizes + uma função não linear + gradiente descendente.
 *
 * Rode:  npx tsx 01-rede-neural-xor.ts
 */

type Matriz = number[][];

// Gerador pseudoaleatório com semente, para resultados reproduzíveis.
let semente = 42;
function aleatorio(): number {
  semente = (semente * 1664525 + 1013904223) % 2 ** 32;
  return semente / 2 ** 32;
}
function normal(): number {
  // Box-Muller: transforma uniforme em distribuição normal.
  const u = 1 - aleatorio();
  const v = aleatorio();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const matriz = (l: number, c: number, f: () => number): Matriz =>
  Array.from({ length: l }, () => Array.from({ length: c }, f));

const mult = (A: Matriz, B: Matriz): Matriz =>
  A.map((linha) => B[0].map((_, j) => linha.reduce((s, a, k) => s + a * B[k][j], 0)));

const transposta = (A: Matriz): Matriz => A[0].map((_, j) => A.map((linha) => linha[j]));

const somaLinha = (A: Matriz, b: number[]): Matriz => A.map((linha) => linha.map((v, j) => v + b[j]));

const sigmoide = (z: number) => 1 / (1 + Math.exp(-z));

// ---------------------------------------------------------------- 1. DADOS
const X: Matriz = [[0, 0], [0, 1], [1, 0], [1, 1]];
const y: number[] = [0, 1, 1, 0];

// ---------------------------------------------------------------- 2. MODELO
const ESCONDIDA = 4;
let W1 = matriz(2, ESCONDIDA, normal);
let b1 = new Array(ESCONDIDA).fill(0);
let W2 = matriz(ESCONDIDA, 1, normal);
let b2 = [0];

function forward(entrada: Matriz) {
  const h = somaLinha(mult(entrada, W1), b1).map((l) => l.map(Math.tanh));
  const saida = somaLinha(mult(h, W2), b2).map((l) => sigmoide(l[0]));
  return { h, saida };
}

function perda(previsto: number[], real: number[]): number {
  const eps = 1e-9;
  const total = previsto.reduce(
    (s, p, i) => s - (real[i] * Math.log(p + eps) + (1 - real[i]) * Math.log(1 - p + eps)),
    0,
  );
  return total / previsto.length;
}

// ---------------------------------------------------------------- 3. TREINO
const TAXA = 0.5;
const EPOCAS = 5000;

for (let epoca = 0; epoca <= EPOCAS; epoca++) {
  const { h, saida } = forward(X);

  // Backpropagation (mesma matemática da versão Python).
  const dSaida: Matriz = saida.map((p, i) => [(p - y[i]) / X.length]);
  const dW2 = mult(transposta(h), dSaida);
  const db2 = [dSaida.reduce((s, l) => s + l[0], 0)];
  const dH = mult(dSaida, transposta(W2)).map((l, i) => l.map((v, j) => v * (1 - h[i][j] ** 2)));
  const dW1 = mult(transposta(X), dH);
  const db1 = dH[0].map((_, j) => dH.reduce((s, l) => s + l[j], 0));

  W2 = W2.map((l, i) => l.map((v, j) => v - TAXA * dW2[i][j]));
  b2 = b2.map((v, j) => v - TAXA * db2[j]);
  W1 = W1.map((l, i) => l.map((v, j) => v - TAXA * dW1[i][j]));
  b1 = b1.map((v, j) => v - TAXA * db1[j]);

  if (epoca % 1000 === 0) {
    console.log(`época ${String(epoca).padStart(5)}  perda ${perda(saida, y).toFixed(4)}`);
  }
}

// ---------------------------------------------------------------- 4/5. VALIDAÇÃO E INFERÊNCIA
const { saida } = forward(X);
const acuracia = saida.filter((p, i) => Number(p > 0.5) === y[i]).length / y.length;
console.log(`\nacurácia: ${(acuracia * 100).toFixed(0)}%`);
X.forEach(([a, b], i) => {
  console.log(`${a} XOR ${b} = ${saida[i].toFixed(3)}  ->  ${Number(saida[i] > 0.5)}`);
});
