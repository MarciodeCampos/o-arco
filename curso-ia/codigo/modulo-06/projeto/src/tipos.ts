import type { z } from "zod";

/**
 * Quanto uma ferramenta pode estragar. O agente decide pelo risco, não pelo nome:
 *  - leitura:      consulta, sem efeito no mundo → executa direto
 *  - escrita:      cria algo reversível (um chamado, uma nota) → executa e registra
 *  - irreversivel: cancela, paga, apaga, envia → só com aprovação humana
 */
export type Risco = "leitura" | "escrita" | "irreversivel";

export interface Ferramenta<S extends z.ZodTypeAny = z.ZodTypeAny> {
  nome: string;
  descricao: string;
  parametros: S;
  risco: Risco;
  executar: (args: z.infer<S>) => Promise<unknown> | unknown;
}

/**
 * Define uma ferramenta com os tipos dos parâmetros inferidos do schema Zod
 * (o `executar` recebe `args` já tipado) e a devolve no tipo comum da lista.
 */
export function definirFerramenta<S extends z.ZodTypeAny>(f: Ferramenta<S>): Ferramenta {
  return f as unknown as Ferramenta;
}

/** Cada coisa que o agente faz vira um evento. A lista de eventos é a TRAJETÓRIA. */
export type Evento =
  | { tipo: "inicio"; tarefa: string; agente: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "chamada"; ferramenta: string; args: unknown; id: string }
  | { tipo: "resultado"; ferramenta: string; id: string; ok: boolean; resumo: string }
  | { tipo: "aprovacao"; ferramenta: string; args: unknown; aprovada: boolean }
  | { tipo: "uso"; tokensEntrada: number; tokensSaida: number; custoUsd: number }
  | { tipo: "poda"; resultadosPodados: number }
  | { tipo: "fim"; motivo: MotivoFim; resposta: string; passos: number; custoUsd: number };

export type MotivoFim = "concluido" | "orcamento_passos" | "orcamento_custo" | "loop_detectado" | "recusa" | "max_tokens";

export interface Orcamento {
  /** Máximo de chamadas ao modelo (cada volta do loop). */
  maxPassos: number;
  /** Teto de custo em US$ para a tarefa inteira. */
  maxCustoUsd: number;
}

export interface ResultadoAgente {
  resposta: string;
  motivo: MotivoFim;
  passos: number;
  custoUsd: number;
  trajetoria: Evento[];
}
