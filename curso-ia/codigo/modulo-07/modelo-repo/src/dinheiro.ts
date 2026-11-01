/** Dinheiro em centavos inteiros. Nunca use ponto flutuante para valores monetários. */
export type Centavos = number;

export function centavos(reais: number): Centavos {
  return Math.round(reais * 100);
}

export function formatar(c: Centavos): string {
  const sinal = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  const inteiro = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sinal}R$ ${inteiro},${String(abs % 100).padStart(2, "0")}`;
}

/** Aplica um percentual arredondando para o centavo mais próximo (meio centavo arredonda para cima). */
export function percentual(c: Centavos, pct: number): Centavos {
  return Math.round((c * pct) / 100);
}
