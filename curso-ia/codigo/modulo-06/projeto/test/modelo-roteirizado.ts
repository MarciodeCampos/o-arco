/**
 * Um "modelo" de mentira para testar agentes sem API: cada chamada devolve a
 * próxima resposta de um roteiro. Também guarda as requisições recebidas,
 * para os testes inspecionarem o que o agente mandou.
 */
import Anthropic from "@anthropic-ai/sdk";

type Bloco =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

export type PassoDoRoteiro = Bloco[] | ((requisicao: { messages: Anthropic.MessageParam[]; model: string }) => Bloco[]);

let contador = 0;
export const texto = (t: string): Bloco => ({ type: "text", text: t });
export const ferramenta = (name: string, input: unknown): Bloco => ({ type: "tool_use", id: `toolu_${++contador}`, name, input });

export function modeloRoteirizado(roteiro: PassoDoRoteiro[], tokens = { entrada: 1000, saida: 100 }) {
  const requisicoes: { messages: Anthropic.MessageParam[]; model: string; system?: string; tools?: unknown[] }[] = [];
  const fetchFalso: typeof fetch = async (_url, init) => {
    const corpo = JSON.parse(String(init?.body));
    requisicoes.push(structuredClone(corpo));
    const passo = roteiro.shift();
    if (!passo) throw new Error("Roteiro acabou: o agente fez mais chamadas que o esperado");
    const conteudo = typeof passo === "function" ? passo(corpo) : passo;
    const corpoResposta = {
      id: `msg_${requisicoes.length}`,
      type: "message",
      role: "assistant",
      model: corpo.model,
      stop_reason: conteudo.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: tokens.entrada, output_tokens: tokens.saida },
      content: conteudo,
    };
    return new Response(JSON.stringify(corpoResposta), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { client: new Anthropic({ apiKey: "teste", fetch: fetchFalso, maxRetries: 0 }), requisicoes };
}
