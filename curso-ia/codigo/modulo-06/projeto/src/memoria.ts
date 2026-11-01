/**
 * Memória de longo prazo por cliente: fatos que valem entre conversas
 * ("prefere contato por e-mail", "já recebeu cupom em outubro").
 *
 * Três tipos de memória num agente:
 *  - de trabalho:  o histórico da conversa atual (a janela de contexto)
 *  - episódica:    o que aconteceu em conversas passadas (aqui: notas por cliente)
 *  - semântica:    conhecimento geral do domínio (a documentação, via RAG, Módulo 4)
 *
 * O agente lê a memória do cliente no início e pode gravar notas com uma ferramenta.
 * Persistimos em JSON; em produção, um banco com retenção e direito de exclusão (LGPD).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { definirFerramenta, type Ferramenta } from "./tipos.js";

export class MemoriaDeClientes {
  private notas: Record<string, { quando: string; nota: string }[]>;

  constructor(private arquivo?: string) {
    this.notas = arquivo && existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, "utf-8")) : {};
  }

  lembrar(cliente: string, limite = 10): string {
    const ns = (this.notas[cliente] ?? []).slice(-limite);
    return ns.length ? ns.map((n) => `- (${n.quando.slice(0, 10)}) ${n.nota}`).join("\n") : "(nenhuma nota)";
  }

  anotar(cliente: string, nota: string, quando = new Date().toISOString()) {
    (this.notas[cliente] ??= []).push({ quando, nota });
    if (this.arquivo) writeFileSync(this.arquivo, JSON.stringify(this.notas, null, 2));
  }

  esquecer(cliente: string) {
    delete this.notas[cliente];
    if (this.arquivo) writeFileSync(this.arquivo, JSON.stringify(this.notas, null, 2));
  }

  /** A ferramenta que o agente usa para gravar. Só aceita fatos úteis e curtos. */
  ferramenta(cliente: string): Ferramenta {
    return definirFerramenta({
      nome: "anotar_memoria",
      descricao:
        "Grava um fato duradouro sobre o cliente para conversas futuras (preferências, acordos feitos). " +
        "Não grave dados sensíveis (documentos, cartões, senhas) nem o conteúdo inteiro da conversa.",
      parametros: z.object({ nota: z.string().min(5).max(200) }),
      risco: "escrita",
      executar: ({ nota }) => {
        if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b(?:\d[ -]?){13,16}\b/.test(nota)) {
          throw new Error("A nota parece conter CPF ou número de cartão. Não grave dados sensíveis.");
        }
        this.anotar(cliente, nota);
        return "anotado";
      },
    });
  }
}
