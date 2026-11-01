/** Cliente da API falso: responde streaming (SSE) e JSON, sem rede, para testes. */
import Anthropic from "@anthropic-ai/sdk";

export const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function apiFalsa(opcoes: { textoChat?: string; analise?: unknown; atrasoMs?: number } = {}) {
  const requisicoes: Record<string, unknown>[] = [];
  const fetchFalso: typeof fetch = async (_url, init) => {
    const corpo = JSON.parse(String(init?.body));
    requisicoes.push(corpo);
    const base = { id: "msg_1", type: "message", role: "assistant", model: corpo.model, stop_sequence: null };

    if (corpo.stream) {
      const pedacos = (opcoes.textoChat ?? "Olá! Posso ajudar com seu pedido.").split(/(?<= )/);
      const enc = new TextEncoder();
      const ev = (nome: string, dados: unknown) => enc.encode(`event: ${nome}\ndata: ${JSON.stringify(dados)}\n\n`);
      const sinal = init?.signal;
      const corpoSse = new ReadableStream({
        async start(ctrl) {
          ctrl.enqueue(ev("message_start", { type: "message_start", message: { ...base, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } }));
          ctrl.enqueue(ev("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }));
          for (const p of pedacos) {
            if (sinal?.aborted) return ctrl.error(new DOMException("aborted", "AbortError"));
            if (opcoes.atrasoMs) await new Promise((r) => setTimeout(r, opcoes.atrasoMs));
            ctrl.enqueue(ev("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: p } }));
          }
          ctrl.enqueue(ev("content_block_stop", { type: "content_block_stop", index: 0 }));
          ctrl.enqueue(ev("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: pedacos.length } }));
          ctrl.enqueue(ev("message_stop", { type: "message_stop" }));
          ctrl.close();
        },
      });
      return new Response(corpoSse, { status: 200, headers: { "content-type": "text/event-stream" } });
    }

    const analise = opcoes.analise ?? {
      tipo: "nota_fiscal",
      descricao: "Cupom fiscal de padaria",
      texto_legivel: ["PADARIA PÃO DOURADO", "TOTAL R$ 27,30"],
      valores: [{ rotulo: "Total", valor: "R$ 27,30" }, { rotulo: "Data", valor: "14/10/2026" }],
      alertas: [],
      confianca: "alta",
    };
    return new Response(
      JSON.stringify({ ...base, stop_reason: "end_turn", usage: { input_tokens: 900, output_tokens: 80 }, content: [{ type: "text", text: JSON.stringify(analise) }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return { client: new Anthropic({ apiKey: "teste", fetch: fetchFalso, maxRetries: 0 }), requisicoes };
}
