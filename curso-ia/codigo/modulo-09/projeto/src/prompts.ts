/**
 * Registro de prompts versionados, com rollout canário.
 *
 * Prompt é código: cada versão fica em prompts/<tarefa>.json, com uma versão
 * "estavel" e, opcionalmente, uma "candidata" recebendo uma fração do tráfego.
 * A escolha é determinística pelo id da requisição, para o mesmo pedido cair
 * sempre na mesma versão (e os logs permitirem comparar as duas).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Tarefa } from "./politicas.js";

export interface ArquivoDePrompt {
  estavel: string;
  candidata?: string;
  /** Fração do tráfego (0 a 1) que vai para a candidata. */
  fracaoCandidata?: number;
  versoes: Record<string, { sistema: string; criadoEm: string; nota: string }>;
}

export function carregarPrompts(pasta: URL): Record<Tarefa, ArquivoDePrompt> {
  const tarefas: Tarefa[] = ["classificar", "extrair", "resumir", "geral"];
  return Object.fromEntries(tarefas.map((t) => [t, JSON.parse(readFileSync(new URL(`${t}.json`, pasta), "utf-8"))])) as Record<
    Tarefa,
    ArquivoDePrompt
  >;
}

/** Número estável em [0, 1) a partir de um texto. */
export function balde(texto: string): number {
  return createHash("sha256").update(texto).digest().readUInt32BE(0) / 2 ** 32;
}

export function escolherVersao(arq: ArquivoDePrompt, idRequisicao: string): { versao: string; sistema: string } {
  const usarCandidata = arq.candidata && balde(idRequisicao) < (arq.fracaoCandidata ?? 0);
  const versao = usarCandidata ? arq.candidata! : arq.estavel;
  const v = arq.versoes[versao];
  if (!v) throw new Error(`Versão de prompt inexistente: ${versao}`);
  return { versao, sistema: v.sistema };
}
