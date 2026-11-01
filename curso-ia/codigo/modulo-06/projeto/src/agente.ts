/**
 * Um agente do zero: o loop de ferramentas do Módulo 2, mais o que separa um
 * protótipo de algo que você deixaria rodar sozinho.
 *
 *   ✓ orçamento de passos e de custo (para graciosamente, em vez de ser cortado)
 *   ✓ detector de loop (mesma ferramenta com os mesmos argumentos, várias vezes)
 *   ✓ aprovação humana para ações irreversíveis
 *   ✓ validação dos argumentos de cada ferramenta (Zod)
 *   ✓ chamadas paralelas executadas juntas, resultados devolvidos numa mensagem só
 *   ✓ poda de contexto: resultados antigos de ferramentas saem do histórico
 *   ✓ trajetória completa: cada passo vira um evento auditável e avaliável
 *
 * É o que frameworks como LangGraph, os SDKs de agentes dos provedores e o tool
 * runner do SDK fazem por você. Escrever uma vez é o melhor jeito de usá-los bem.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Evento, Ferramenta, MotivoFim, Orcamento, ResultadoAgente } from "./tipos.js";

export const PRECOS: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export type Aprovador = (chamada: { ferramenta: string; args: unknown }) => Promise<boolean>;

export interface ConfigAgente {
  nome: string;
  modelo?: string;
  sistema: string;
  ferramentas: Ferramenta[];
  orcamento?: Partial<Orcamento>;
  /** Quantos resultados de ferramenta manter íntegros no histórico (os mais recentes). */
  manterResultados?: number;
  /** Quem aprova ações irreversíveis. Sem aprovador, elas são sempre negadas. */
  aprovar?: Aprovador;
  /** Recebe cada evento assim que acontece (log, UI, arquivo). */
  aoEvento?: (e: Evento) => void;
}

const ORCAMENTO_PADRAO: Orcamento = { maxPassos: 8, maxCustoUsd: 0.5 };

export class Agente {
  readonly modelo: string;
  private orcamento: Orcamento;

  constructor(
    private client: Anthropic,
    private cfg: ConfigAgente,
  ) {
    this.modelo = cfg.modelo ?? "claude-opus-5-5";
    this.orcamento = { ...ORCAMENTO_PADRAO, ...cfg.orcamento };
  }

  /** As ferramentas no formato da API. O risco vai na descrição para o modelo saber o que exige aprovação. */
  private ferramentasDaApi(): Anthropic.Tool[] {
    return this.cfg.ferramentas.map((f) => ({
      name: f.nome,
      description: f.risco === "irreversivel" ? `${f.descricao} (AÇÃO IRREVERSÍVEL: exige aprovação humana)` : f.descricao,
      input_schema: esquemaJson(f.parametros),
    }));
  }

  async executar(tarefa: string): Promise<ResultadoAgente> {
    const trajetoria: Evento[] = [];
    const registrar = (e: Evento) => {
      trajetoria.push(e);
      this.cfg.aoEvento?.(e);
    };
    const mensagens: Anthropic.MessageParam[] = [{ role: "user", content: tarefa }];
    const assinaturas = new Map<string, number>(); // ferramenta+args → vezes chamada
    let custo = 0;
    let passos = 0;
    let ultimoTexto = "";

    registrar({ tipo: "inicio", tarefa, agente: this.cfg.nome });

    const fim = (motivo: MotivoFim, resposta: string): ResultadoAgente => {
      registrar({ tipo: "fim", motivo, resposta, passos, custoUsd: custo });
      return { resposta, motivo, passos, custoUsd: custo, trajetoria };
    };

    while (true) {
      if (passos >= this.orcamento.maxPassos) {
        return fim("orcamento_passos", ultimoTexto || "Não consegui concluir dentro do limite de passos.");
      }
      if (custo >= this.orcamento.maxCustoUsd) {
        return fim("orcamento_custo", ultimoTexto || "Não consegui concluir dentro do orçamento.");
      }

      this.podarResultadosAntigos(mensagens, registrar);
      passos++;
      const resposta = await this.client.messages.create({
        model: this.modelo,
        max_tokens: 8000,
        system:
          `${this.cfg.sistema}\n\n` +
          // O agente sabe do próprio orçamento: com isso ele prioriza e conclui, em vez de ser cortado.
          `Você tem no máximo ${this.orcamento.maxPassos} passos para esta tarefa. Quando faltarem poucos, conclua com o que tiver.`,
        tools: this.ferramentasDaApi(),
        messages: mensagens,
        output_config: { effort: "medium" },
      });

      const [pIn, pOut] = PRECOS[this.modelo] ?? [0, 0];
      const custoPasso = (resposta.usage.input_tokens * pIn + resposta.usage.output_tokens * pOut) / 1e6;
      custo += custoPasso;
      registrar({ tipo: "uso", tokensEntrada: resposta.usage.input_tokens, tokensSaida: resposta.usage.output_tokens, custoUsd: custoPasso });

      const texto = resposta.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      if (texto) {
        ultimoTexto = texto;
        registrar({ tipo: "texto", texto });
      }
      mensagens.push({ role: "assistant", content: resposta.content });

      if (resposta.stop_reason === "refusal") return fim("recusa", "O modelo recusou a tarefa.");
      if (resposta.stop_reason === "max_tokens") return fim("max_tokens", texto || "Resposta cortada por max_tokens.");
      if (resposta.stop_reason !== "tool_use") return fim("concluido", texto);

      const chamadas = resposta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

      // Detector de loop: a mesma chamada 3 vezes indica que o agente está andando em círculos.
      for (const c of chamadas) {
        const assinatura = `${c.name}:${JSON.stringify(c.input)}`;
        const vezes = (assinaturas.get(assinatura) ?? 0) + 1;
        assinaturas.set(assinatura, vezes);
        if (vezes >= 3) return fim("loop_detectado", ultimoTexto || "Parei: o agente repetiu a mesma ação várias vezes.");
      }

      // Chamadas paralelas: executa todas juntas, devolve todos os resultados numa mensagem só.
      const resultados = await Promise.all(chamadas.map((c) => this.executarFerramenta(c, registrar)));
      mensagens.push({ role: "user", content: resultados });
    }
  }

  private async executarFerramenta(c: Anthropic.ToolUseBlock, registrar: (e: Evento) => void): Promise<Anthropic.ToolResultBlockParam> {
    registrar({ tipo: "chamada", ferramenta: c.name, args: c.input, id: c.id });
    const erro = (msg: string): Anthropic.ToolResultBlockParam => {
      registrar({ tipo: "resultado", ferramenta: c.name, id: c.id, ok: false, resumo: msg });
      return { type: "tool_result", tool_use_id: c.id, content: msg, is_error: true };
    };

    const f = this.cfg.ferramentas.find((x) => x.nome === c.name);
    if (!f) return erro(`Ferramenta desconhecida: ${c.name}`);

    const args = f.parametros.safeParse(c.input);
    if (!args.success) return erro(`Argumentos inválidos: ${args.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);

    if (f.risco === "irreversivel") {
      const aprovada = this.cfg.aprovar ? await this.cfg.aprovar({ ferramenta: f.nome, args: args.data }) : false;
      registrar({ tipo: "aprovacao", ferramenta: f.nome, args: args.data, aprovada });
      if (!aprovada) {
        return erro("Ação NÃO executada: o responsável humano negou a aprovação. Informe o cliente e não tente de novo.");
      }
    }

    try {
      const saida = await f.executar(args.data);
      const texto = typeof saida === "string" ? saida : JSON.stringify(saida);
      registrar({ tipo: "resultado", ferramenta: c.name, id: c.id, ok: true, resumo: texto.slice(0, 200) });
      return { type: "tool_result", tool_use_id: c.id, content: texto };
    } catch (e) {
      return erro(e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * Gerência de contexto: mantém íntegros só os N resultados de ferramenta mais recentes.
   * Os antigos viram um marcador curto. Em tarefas longas, isso evita que o contexto (e o
   * custo, que cresce a cada passo porque o histórico é reenviado) exploda.
   * A API também oferece isso no servidor (context editing e compactação, em beta).
   */
  private podarResultadosAntigos(mensagens: Anthropic.MessageParam[], registrar: (e: Evento) => void) {
    const manter = this.cfg.manterResultados ?? 6;
    const blocos = mensagens.flatMap((m) =>
      m.role === "user" && Array.isArray(m.content)
        ? m.content.filter((b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result")
        : [],
    );
    const antigos = blocos.slice(0, Math.max(0, blocos.length - manter)).filter((b) => b.content !== MARCADOR_PODA);
    for (const b of antigos) b.content = MARCADOR_PODA;
    if (antigos.length) registrar({ tipo: "poda", resultadosPodados: antigos.length });
  }
}

/** Zod → JSON Schema para a API (sem a chave "$schema", que a API não precisa). */
export function esquemaJson(s: z.ZodTypeAny): Anthropic.Tool.InputSchema {
  const { $schema: _, ...resto } = z.toJSONSchema(s) as Record<string, unknown>;
  return resto as Anthropic.Tool.InputSchema;
}

export const MARCADOR_PODA = "[resultado antigo removido para economizar contexto; chame a ferramenta de novo se precisar]";
