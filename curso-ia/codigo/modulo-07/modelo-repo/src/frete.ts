import type { Centavos } from "./dinheiro.js";

export interface CotacaoFrete {
  regiao: string;
  valor: Centavos;
  prazoDiasUteis: number;
}

const FAIXAS: { prefixos: string[]; regiao: string; base: Centavos; porKg: Centavos; prazo: number }[] = [
  { prefixos: ["0"], regiao: "SP capital", base: 1800, porKg: 650, prazo: 2 },
  { prefixos: ["1"], regiao: "SP interior", base: 2200, porKg: 700, prazo: 4 },
  { prefixos: ["2", "3"], regiao: "Sudeste", base: 2900, porKg: 800, prazo: 5 },
  { prefixos: ["8", "9"], regiao: "Sul", base: 3200, porKg: 850, prazo: 6 },
  { prefixos: ["4", "5", "6", "7"], regiao: "Norte, Nordeste e Centro-Oeste", base: 3900, porKg: 1100, prazo: 9 },
];

export function cotarFrete(cep: string, pesoKg: number): CotacaoFrete {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) throw new Error(`CEP inválido: "${cep}" (precisa de 8 dígitos)`);
  if (!(pesoKg > 0) || pesoKg > 30) throw new Error(`Peso inválido: ${pesoKg} kg (de 0 a 30 kg)`);
  const faixa = FAIXAS.find((f) => f.prefixos.includes(digitos[0]))!;
  // Cobra por kg iniciado: 2,1 kg paga como 3 kg.
  const valor = faixa.base + faixa.porKg * Math.ceil(pesoKg);
  return { regiao: faixa.regiao, valor, prazoDiasUteis: faixa.prazo };
}
