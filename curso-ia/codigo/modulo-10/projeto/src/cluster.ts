/**
 * Um cluster Kubernetes SIMULADO, carregado de um arquivo de cenário.
 *
 * Num ambiente real, estas funções chamariam a API do Kubernetes (ou um servidor MCP
 * de Kubernetes) com uma conta de serviço de permissões mínimas. A simulação deixa
 * o projeto rodar offline e os testes serem determinísticos, sem um cluster.
 */
import { readFileSync } from "node:fs";

export interface Pod {
  nome: string;
  status: string;
  reinicios: number;
  revisao: number;
  ultimoMotivo: string | null;
}

export interface Cenario {
  descricao: string;
  servico: string;
  deployment: {
    nome: string;
    revisaoAtual: number;
    historico: { revisao: number; imagem: string; quando: string; autor: string; mudanca: string }[];
    replicas: number;
    recursos: { memoria: string; cpu: string };
  };
  pods: Pod[];
  eventos: string[];
  logs: Record<string, string[]>;
  metricas: Record<string, number[]>;
  acaoCorreta: { ferramenta: string; args: Record<string, unknown> };
}

export function carregarCenario(nome: string): Cenario {
  return JSON.parse(readFileSync(new URL(`../cenarios/${nome}.json`, import.meta.url), "utf-8"));
}

export class ClusterSimulado {
  readonly acoes: { acao: string; detalhe: string }[] = [];
  constructor(readonly c: Cenario) {}

  pods(deployment: string): Pod[] {
    this.exigirDeployment(deployment);
    return this.c.pods;
  }

  descrever(deployment: string) {
    const d = this.exigirDeployment(deployment);
    return { deployment: d.nome, revisaoAtual: d.revisaoAtual, replicas: d.replicas, recursos: d.recursos, historico: d.historico, eventos: this.c.eventos };
  }

  logs(pod: string, linhas: number): string[] {
    if (!this.c.pods.some((p) => p.nome === pod)) throw new Error(`Pod ${pod} não existe. Pods: ${this.c.pods.map((p) => p.nome).join(", ")}`);
    return (this.c.logs[pod] ?? this.c.logs["*"] ?? []).slice(-linhas);
  }

  metricas(deployment: string): Record<string, number[]> {
    this.exigirDeployment(deployment);
    return this.c.metricas;
  }

  rollback(deployment: string, revisao: number): string {
    const d = this.exigirDeployment(deployment);
    const alvo = d.historico.find((h) => h.revisao === revisao);
    if (!alvo) throw new Error(`Revisão ${revisao} não existe no histórico de ${deployment}`);
    if (revisao === d.revisaoAtual) throw new Error(`Revisão ${revisao} já é a atual`);
    d.revisaoAtual = revisao;
    for (const p of this.c.pods) Object.assign(p, { status: "Running", reinicios: 0, revisao, ultimoMotivo: null });
    this.acoes.push({ acao: "rollback", detalhe: `${deployment} → revisão ${revisao} (${alvo.imagem})` });
    return `Rollback de ${deployment} para a revisão ${revisao} (${alvo.imagem}) concluído; pods reiniciando.`;
  }

  ajustarRecursos(deployment: string, memoria?: string, cpu?: string): string {
    const d = this.exigirDeployment(deployment);
    const antes = { ...d.recursos };
    if (memoria) d.recursos.memoria = memoria;
    if (cpu) d.recursos.cpu = cpu;
    this.acoes.push({ acao: "ajustar_recursos", detalhe: `${deployment}: ${JSON.stringify(antes)} → ${JSON.stringify(d.recursos)}` });
    return `Recursos de ${deployment} ajustados: ${JSON.stringify(d.recursos)}.`;
  }

  private exigirDeployment(nome: string) {
    if (nome !== this.c.deployment.nome) throw new Error(`Deployment ${nome} não existe. Disponível: ${this.c.deployment.nome}`);
    return this.c.deployment;
  }
}
