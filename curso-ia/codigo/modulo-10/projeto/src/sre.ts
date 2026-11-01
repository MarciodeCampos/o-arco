/**
 * O agente de SRE: investiga um serviço com ferramentas de leitura, registra um
 * diagnóstico estruturado e PROPÕE a correção. Ações que mudam o cluster (rollback,
 * recursos) passam por aprovação humana — no ChatOps, é o botão "Aprovar" no canal.
 *
 * Reaproveita o agente do Módulo 6: orçamento, detecção de loop, aprovação e trajetória.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Agente, type Aprovador } from "../../../modulo-06/projeto/src/agente.js";
import { definirFerramenta, type Evento } from "../../../modulo-06/projeto/src/tipos.js";
import type { ClusterSimulado } from "./cluster.js";

export const Diagnostico = z.object({
  sintoma: z.string().describe("O que está acontecendo, do ponto de vista do usuário"),
  causa_provavel: z.string(),
  evidencias: z.array(z.string()).min(1).describe("Linhas de log, eventos, métricas ou mudanças que sustentam a causa"),
  confianca: z.enum(["alta", "media", "baixa"]),
  acao_proposta: z.string().describe("A correção recomendada e por que ela é segura"),
  prevencao: z.string().describe("O que evitaria a repetição (teste, alerta, validação no CI)"),
});
export type Diagnostico = z.infer<typeof Diagnostico>;

const SISTEMA = `Você é um engenheiro de SRE investigando um incidente em Kubernetes.

Método (ReAct): observe → formule uma hipótese → busque evidência que a confirme ou descarte → repita.
1. Comece pelo estado dos pods e pelos eventos; depois logs e métricas.
2. Procure a MUDANÇA mais recente (deploy, configuração, tráfego): a maioria dos incidentes começa com uma.
3. Antes de propor ação, registre o diagnóstico com registrar_diagnostico, citando evidências concretas.
4. Prefira a correção mais segura e reversível (ex.: rollback para a última revisão saudável) a mudanças novas.
5. Ações que alteram o cluster exigem aprovação humana. Se forem negadas, não insista: explique as alternativas.
Responda em português, de forma objetiva.`;

export function criarAgenteSre(
  client: Anthropic,
  cluster: ClusterSimulado,
  opcoes: { aprovar?: Aprovador; aoEvento?: (e: Evento) => void } = {},
) {
  let diagnostico: Diagnostico | null = null;
  const ferramentas = [
    definirFerramenta({
      nome: "listar_pods",
      descricao: "Lista os pods de um deployment com status, reinícios, revisão e último motivo de término.",
      parametros: z.object({ deployment: z.string() }),
      risco: "leitura",
      executar: ({ deployment }) => cluster.pods(deployment),
    }),
    definirFerramenta({
      nome: "descrever_deployment",
      descricao: "Mostra revisão atual, réplicas, recursos, histórico de revisões (o que mudou e quando) e eventos recentes.",
      parametros: z.object({ deployment: z.string() }),
      risco: "leitura",
      executar: ({ deployment }) => cluster.descrever(deployment),
    }),
    definirFerramenta({
      nome: "ler_logs",
      descricao: "Lê as últimas linhas de log de um pod.",
      parametros: z.object({ pod: z.string(), linhas: z.number().int().min(1).max(200).default(50) }),
      risco: "leitura",
      executar: ({ pod, linhas }) => cluster.logs(pod, linhas),
    }),
    definirFerramenta({
      nome: "consultar_metricas",
      descricao: "Séries das últimas 7 janelas de 5 min: taxa de erro 5xx (%), latência p95 (ms), memória (%), requisições/s.",
      parametros: z.object({ deployment: z.string() }),
      risco: "leitura",
      executar: ({ deployment }) => cluster.metricas(deployment),
    }),
    definirFerramenta({
      nome: "registrar_diagnostico",
      descricao: "Registra o diagnóstico estruturado do incidente. Obrigatório antes de propor ou executar qualquer ação.",
      parametros: Diagnostico,
      risco: "escrita",
      executar: (d) => {
        diagnostico = d;
        return "diagnóstico registrado";
      },
    }),
    definirFerramenta({
      nome: "fazer_rollback",
      descricao: "Volta o deployment para uma revisão anterior do histórico.",
      parametros: z.object({ deployment: z.string(), revisao: z.number().int() }),
      risco: "irreversivel",
      executar: ({ deployment, revisao }) => {
        if (!diagnostico) throw new Error("Registre o diagnóstico antes de agir.");
        return cluster.rollback(deployment, revisao);
      },
    }),
    definirFerramenta({
      nome: "ajustar_recursos",
      descricao: "Altera os limites de memória e/ou CPU do deployment (ex.: memoria '2Gi', cpu '1').",
      parametros: z.object({ deployment: z.string(), memoria: z.string().regex(/^\d+(Mi|Gi)$/).optional(), cpu: z.string().regex(/^\d+m?$/).optional() }),
      risco: "irreversivel",
      executar: ({ deployment, memoria, cpu }) => {
        if (!diagnostico) throw new Error("Registre o diagnóstico antes de agir.");
        return cluster.ajustarRecursos(deployment, memoria, cpu);
      },
    }),
  ];

  const agente = new Agente(client, {
    nome: "sre",
    sistema: SISTEMA,
    ferramentas,
    orcamento: { maxPassos: 12, maxCustoUsd: 1 },
    aprovar: opcoes.aprovar,
    aoEvento: opcoes.aoEvento,
  });
  return {
    investigar: async (servico: string, alerta: string) => {
      const r = await agente.executar(`Alerta: ${alerta}\nServiço: ${servico}\nInvestigue, diagnostique e proponha (ou execute, com aprovação) a correção.`);
      return { ...r, diagnostico: diagnostico as Diagnostico | null };
    },
  };
}
