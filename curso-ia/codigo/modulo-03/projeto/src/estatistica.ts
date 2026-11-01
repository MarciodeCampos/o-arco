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

/**
 * Meia-largura aproximada (pior caso, taxa perto de 50%) do IC de 95% de uma taxa: ±1/√casos.
 *
 * A unidade é o CASO, não a execução. Repetir os mesmos casos reduz o ruído da geração
 * (o modelo responder diferente a cada vez), mas não traz casos novos: as repetições de um
 * caso são correlacionadas entre si. Por isso o piso não usa casos × repetições. Fórmulas
 * como 1/√(casos × repetições) só valeriam se cada execução fosse um caso independente,
 * e subestimam a incerteza.
 */
export const pisoDeRuido = (casos: number) => 1 / Math.sqrt(casos);

/** Gerador pseudoaleatório com semente (mulberry32): o mesmo resultado a cada execução. */
function geradorComSemente(semente: number): () => number {
  let t = semente >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Reamostragem por caso (bootstrap): sorteia casos com reposição, levando junto
 * todas as repetições de cada caso, e mede quanto a média varia.
 * Recebe UM valor por caso (ex.: a taxa de acerto do caso, média das repetições;
 * ou, para comparar, a diferença B − A daquele caso). Devolve o IC de 95% por percentis.
 * Não supõe distribuição normal e respeita a correlação entre repetições do mesmo caso.
 */
export function bootstrapPorCaso(
  valoresPorCaso: number[],
  amostras = 5000,
  semente = 42,
): { media: number; inferior: number; superior: number } {
  const n = valoresPorCaso.length;
  if (n === 0) return { media: NaN, inferior: NaN, superior: NaN };
  const aleatorio = geradorComSemente(semente);
  const medias: number[] = [];
  for (let k = 0; k < amostras; k++) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += valoresPorCaso[Math.floor(aleatorio() * n)];
    medias.push(soma / n);
  }
  return { media: media(valoresPorCaso), inferior: percentil(medias, 0.025), superior: percentil(medias, 0.975) };
}
