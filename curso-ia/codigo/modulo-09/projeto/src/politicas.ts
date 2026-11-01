/**
 * Políticas do gateway, declaradas como DADOS, não espalhadas pelo código:
 * qual modelo atende cada tarefa, a ordem de reserva, preços, cotas e prompts.
 * Mudar de modelo vira uma mudança de configuração revisável, não um deploy de cada app.
 */

export type Tarefa = "classificar" | "extrair" | "resumir" | "geral";

/** Cadeia de modelos por tarefa: o 1º é o preferido; os outros são reserva em caso de falha. */
export const ROTAS: Record<Tarefa, string[]> = {
  classificar: ["claude-haiku-5-5", "claude-sonnet-5-5"],
  extrair: ["claude-sonnet-5-5", "claude-opus-5-5"],
  resumir: ["claude-sonnet-5-5", "claude-haiku-5-5"],
  geral: ["claude-opus-5-5", "claude-sonnet-5-5"],
};

/** Esforço de raciocínio por tarefa: tarefas simples não precisam pensar muito. */
export const ESFORCO: Record<Tarefa, "low" | "medium" | "high"> = {
  classificar: "low",
  extrair: "low",
  resumir: "low",
  geral: "medium",
};

/** US$ por 1M de tokens [entrada, saída] — nov/2026. Revise com a página de preços. */
export const PRECOS: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export const custoUsd = (modelo: string, entrada: number, saida: number) => {
  const [pIn, pOut] = PRECOS[modelo] ?? [0, 0];
  return (entrada * pIn + saida * pOut) / 1e6;
};

export interface Cliente {
  id: string;
  /** Teto de gasto por dia, em US$. */
  orcamentoDiarioUsd: number;
  /** Tarefas que este cliente pode usar. */
  tarefas: Tarefa[];
}
