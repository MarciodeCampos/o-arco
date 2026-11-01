/** Métricas de recuperação. `ranking` = ids na ordem devolvida; `relevantes` = ids do gabarito. */

/** Fração dos trechos relevantes que apareceram entre os k primeiros. */
export function recallEmK(ranking: string[], relevantes: string[], k: number): number {
  if (!relevantes.length) return NaN;
  const topo = new Set(ranking.slice(0, k));
  return relevantes.filter((r) => topo.has(r)).length / relevantes.length;
}

/** "Acertou algum?": 1 se pelo menos um relevante está nos k primeiros. */
export function acertoEmK(ranking: string[], relevantes: string[], k: number): number {
  return ranking.slice(0, k).some((r) => relevantes.includes(r)) ? 1 : 0;
}

/** Reciprocal Rank: 1/posição do primeiro relevante (1 = primeiro lugar, 0.5 = segundo...). */
export function rr(ranking: string[], relevantes: string[]): number {
  const i = ranking.findIndex((r) => relevantes.includes(r));
  return i === -1 ? 0 : 1 / (i + 1);
}

/** nDCG@k com relevância binária: premia relevantes no topo, penaliza os que aparecem tarde. */
export function ndcgEmK(ranking: string[], relevantes: string[], k: number): number {
  const dcg = ranking.slice(0, k).reduce((s, r, i) => s + (relevantes.includes(r) ? 1 / Math.log2(i + 2) : 0), 0);
  const ideal = Array.from({ length: Math.min(k, relevantes.length) }, (_, i) => 1 / Math.log2(i + 2)).reduce((a, b) => a + b, 0);
  return ideal ? dcg / ideal : NaN;
}
