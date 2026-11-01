import Anthropic from "@anthropic-ai/sdk";
import type { Resultado } from "./banco.js";

export const MODELO = process.env.MODELO ?? "claude-opus-5-5";

export const SISTEMA = `Você é o assistente de suporte da Brisa, fabricante de purificadores de ar.
Responda em português do Brasil, de forma direta, em até 5 frases.

Use SOMENTE as informações dos resultados de busca fornecidos. Se eles não trouxerem a resposta,
diga exatamente "Não encontrei essa informação na documentação da Brisa." e, se fizer sentido,
sugira falar com o suporte. Não complete com conhecimento geral: um prazo ou valor inventado
vira promessa feita ao cliente.`;

export interface Citacao {
  fonte: string;
  titulo: string | null;
  trecho: string;
}

export interface Resposta {
  texto: string;
  citacoes: Citacao[];
  naoEncontrou: boolean;
  uso: Anthropic.Usage;
}

/**
 * Gera a resposta passando os trechos como blocos `search_result` com citações ativadas.
 * A API devolve, junto com o texto, de qual resultado veio cada afirmação.
 */
export async function responder(client: Anthropic, pergunta: string, trechos: Resultado[]): Promise<Resposta> {
  const resultados: Anthropic.SearchResultBlockParam[] = trechos.map((t) => ({
    type: "search_result",
    source: t.id,
    title: `${t.tituloDoc} — ${t.secao}`,
    content: [{ type: "text", text: t.texto }],
    citations: { enabled: true },
  }));

  const r = await client.messages.create({
    model: MODELO,
    max_tokens: 4000,
    system: SISTEMA,
    messages: [{ role: "user", content: [...resultados, { type: "text", text: pergunta }] }],
    output_config: { effort: "low" },
  });

  if (r.stop_reason === "refusal") {
    return { texto: "[recusado]", citacoes: [], naoEncontrou: false, uso: r.usage };
  }

  let texto = "";
  const citacoes: Citacao[] = [];
  for (const bloco of r.content) {
    if (bloco.type !== "text") continue;
    texto += bloco.text;
    for (const c of bloco.citations ?? []) {
      if (c.type === "search_result_location") {
        citacoes.push({ fonte: c.source, titulo: c.title, trecho: c.cited_text });
      }
    }
  }
  return {
    texto,
    citacoes,
    naoEncontrou: /não encontrei essa informação/i.test(texto),
    uso: r.usage,
  };
}
