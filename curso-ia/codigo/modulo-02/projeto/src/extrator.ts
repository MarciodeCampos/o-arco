import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Recibo } from "./esquema.js";
import type { Uso } from "./custo.js";
import { validarRecibo } from "./validar.js";

// Instruções estáveis no início; só a nota muda entre chamadas. (Este texto tem menos de
// 512 tokens, o mínimo para entrar no cache. Com um prompt maior, marque-o com cache_control.)
const SISTEMA = `Você extrai dados de notas e cupons fiscais brasileiros para um sistema de contabilidade.

Regras:
- Extraia apenas o que está escrito. Não invente valores.
- Valores em reais como número decimal (R$ 1.234,56 → 1234.56).
- Datas no formato AAAA-MM-DD.
- O texto pode vir de OCR, com letras trocadas por números (O→0, I→1, S→5). Corrija quando for óbvio
  e registre a correção em "observacoes".
- Se a soma dos itens não bater com o total impresso, NÃO ajuste os números para fechar a conta:
  copie o que está impresso, use confianca "baixa" e explique em "observacoes".`;

export interface ResultadoExtracao {
  recibo: Recibo | null;
  problemas: string[];
  tentativas: number;
  usos: Uso[];
  /** Modelo que de fato respondeu cada chamada e por que parou (úteis para evals e logs). */
  modelosServidos: string[];
  motivosParada: (string | null)[];
}

/**
 * Extrai um recibo e valida. Se a validação falhar, devolve os erros ao modelo
 * uma vez para que ele revise a leitura (padrão "validar e corrigir").
 */
export async function extrairRecibo(
  client: Anthropic,
  texto: string,
  modelo: string,
  maxTentativas = 2,
): Promise<ResultadoExtracao> {
  const mensagens: Anthropic.MessageParam[] = [
    { role: "user", content: `<nota>\n${texto}\n</nota>\n\nExtraia os dados desta nota.` },
  ];
  const usos: Uso[] = [];
  const modelosServidos: string[] = [];
  const motivosParada: (string | null)[] = [];
  const fim = (r: Pick<ResultadoExtracao, "recibo" | "problemas" | "tentativas">): ResultadoExtracao => ({
    ...r,
    usos,
    modelosServidos,
    motivosParada,
  });
  let recibo: Recibo | null = null;
  let problemas: string[] = [];

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    const resposta = await client.messages.parse({
      model: modelo,
      max_tokens: 4000,
      system: SISTEMA,
      messages: mensagens,
      output_config: { effort: "low", format: zodOutputFormat(Recibo) },
    });
    usos.push(resposta.usage);
    modelosServidos.push(resposta.model);
    motivosParada.push(resposta.stop_reason);

    if (resposta.stop_reason === "refusal") {
      return fim({ recibo: null, problemas: ["O modelo recusou a extração"], tentativas: tentativa });
    }
    recibo = resposta.parsed_output;
    if (!recibo) {
      return fim({ recibo: null, problemas: ["Resposta não pôde ser interpretada"], tentativas: tentativa });
    }

    problemas = validarRecibo(recibo);
    if (problemas.length === 0 || tentativa === maxTentativas) {
      return fim({ recibo, problemas, tentativas: tentativa });
    }

    // Devolve a resposta e os problemas encontrados pelo código para o modelo revisar.
    mensagens.push({ role: "assistant", content: resposta.content });
    mensagens.push({
      role: "user",
      content:
        "Nossa validação automática encontrou estes problemas:\n" +
        problemas.map((p) => `- ${p}`).join("\n") +
        "\n\nReleia a nota. Se foi erro seu de leitura, corrija. Se o problema está na própria nota, " +
        "mantenha os valores impressos, use confianca \"baixa\" e explique em observacoes.",
    });
  }
  return fim({ recibo, problemas, tentativas: maxTentativas });
}
