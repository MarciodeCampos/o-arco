/** Estatística mínima para não tirar conclusões erradas de amostras pequenas. */

export const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function desvioPadrao(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export function percentil(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const ord = [...xs].sort((a, b) => a - b);
  const i = (ord.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return ord[lo] + (ord[hi] - ord[lo]) * (i - lo);
}

/**
 * Intervalo de confiança de 95% (Wilson) para uma taxa de acerto.
 * Mais honesto que "±" simples quando n é pequeno ou a taxa está perto de 0% ou 100%.
 */
export function wilson(acertos: number, n: number, z = 1.96): { taxa: number; inferior: number; superior: number } {
  if (n === 0) return { taxa: NaN, inferior: NaN, superior: NaN };
  const p = acertos / n;
  const z2 = z * z;
  const centro = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margem = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { taxa: p, inferior: Math.max(0, centro - margem), superior: Math.min(1, centro + margem) };
}

/**
 * Diferença pareada: compara A e B *nos mesmos casos*.
 * Recebe a taxa de acerto de cada caso em A e em B (mesma ordem) e devolve a
 * diferença média (B − A) com intervalo de 95% (aproximação normal).
 * Se o intervalo contém 0, a diferença pode ser só ruído.
 */
export function diferencaPareada(a: number[], b: number[]): { media: number; inferior: number; superior: number } {
  if (a.length !== b.length) throw new Error("Os dois lados precisam ter os mesmos casos");
  const d = a.map((x, i) => b[i] - x);
  const m = media(d);
  const ep = desvioPadrao(d) / Math.sqrt(d.length);
  return { media: m, inferior: m - 1.96 * ep, superior: m + 1.96 * ep };
}

/** Meia-largura aproximada do IC de 95% de uma taxa: o "ruído" mínimo do seu eval. */
export const pisoDeRuido = (casos: number, reps: number) => 1 / Math.sqrt(casos * reps);
