/** Preços em US$ por 1M de tokens, conferidos em nov/2026. Revise antes de usar. */
export const PRECOS: Record<string, { entrada: number; saida: number; cacheLeitura: number }> = {
  "claude-opus-5-5": { entrada: 4, saida: 20, cacheLeitura: 0.2 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10, cacheLeitura: 0.2 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5, cacheLeitura: 0.01 },
};

export interface Uso {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Custo de uma chamada em US$.
 * Escrita no cache (TTL de 5 min) custa 1,25× a entrada; o batch dá 50% de desconto em tudo.
 */
export function custoChamada(uso: Uso, modelo: string, opcoes: { batch?: boolean } = {}): number {
  const p = PRECOS[modelo];
  if (!p) throw new Error(`Sem preço cadastrado para ${modelo}`);
  const escrita = uso.cache_creation_input_tokens ?? 0;
  const leitura = uso.cache_read_input_tokens ?? 0;
  const bruto =
    uso.input_tokens * p.entrada + escrita * p.entrada * 1.25 + leitura * p.cacheLeitura + uso.output_tokens * p.saida;
  return (bruto / 1e6) * (opcoes.batch ? 0.5 : 1);
}

export type UsoTotal = { [K in keyof Uso]-?: number };

export function somarUso(usos: Uso[]): UsoTotal {
  return usos.reduce<UsoTotal>(
    (t, u) => ({
      input_tokens: t.input_tokens + u.input_tokens,
      output_tokens: t.output_tokens + u.output_tokens,
      cache_creation_input_tokens: t.cache_creation_input_tokens + (u.cache_creation_input_tokens ?? 0),
      cache_read_input_tokens: t.cache_read_input_tokens + (u.cache_read_input_tokens ?? 0),
    }),
    { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  );
}
