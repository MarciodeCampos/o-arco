/**
 * Lab 2.8 — Erros, retries, timeouts e limites: o que fazer quando a API falha.
 *
 *   npx tsx 05-erros-e-limites.ts
 *
 * O script provoca de propósito alguns erros para você ver como cada um chega.
 */
import Anthropic from "@anthropic-ai/sdk";

// O SDK já tenta de novo, com espera exponencial, em: falhas de conexão,
// 408, 409, 429 (limite de taxa) e erros 5xx. Ajuste aqui, não reimplemente.
const client = new Anthropic({
  maxRetries: 3,   // padrão: 2
  timeout: 60_000, // em milissegundos no SDK TypeScript (padrão: 10 min)
});

type Resultado = { ok: true; texto: string } | { ok: false; tipo: string; tentarDeNovo: boolean; detalhe: string };

/** Classifica o erro: dá para tentar de novo mais tarde, ou o problema é no pedido? */
function classificar(erro: unknown): Resultado {
  if (erro instanceof Anthropic.BadRequestError)
    return { ok: false, tipo: "400 pedido inválido", tentarDeNovo: false, detalhe: erro.message };
  if (erro instanceof Anthropic.AuthenticationError)
    return { ok: false, tipo: "401 chave inválida", tentarDeNovo: false, detalhe: erro.message };
  if (erro instanceof Anthropic.NotFoundError)
    return { ok: false, tipo: "404 modelo ou recurso inexistente", tentarDeNovo: false, detalhe: erro.message };
  if (erro instanceof Anthropic.RateLimitError)
    return { ok: false, tipo: "429 limite de taxa", tentarDeNovo: true, detalhe: erro.message };
  if (erro instanceof Anthropic.APIConnectionTimeoutError)
    return { ok: false, tipo: "timeout", tentarDeNovo: true, detalhe: erro.message };
  if (erro instanceof Anthropic.APIConnectionError)
    return { ok: false, tipo: "sem conexão", tentarDeNovo: true, detalhe: erro.message };
  if (erro instanceof Anthropic.InternalServerError)
    return { ok: false, tipo: "5xx erro do provedor", tentarDeNovo: true, detalhe: erro.message };
  if (erro instanceof Anthropic.APIError)
    return { ok: false, tipo: `erro ${erro.status}`, tentarDeNovo: false, detalhe: erro.message };
  throw erro; // não é erro da API: é bug no nosso código, deixe estourar
}

async function perguntar(params: Anthropic.MessageCreateParamsNonStreaming, opcoes?: Anthropic.RequestOptions) {
  try {
    const r = await client.messages.create(params, opcoes);
    if (r.stop_reason === "refusal") return { ok: false, tipo: "recusa", tentarDeNovo: false, detalhe: "" } as Resultado;
    if (r.stop_reason === "max_tokens") console.warn("  [aviso] resposta cortada: aumente max_tokens");
    return { ok: true, texto: r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("") } as Resultado;
  } catch (erro) {
    return classificar(erro);
  }
}

const base = { max_tokens: 500, messages: [{ role: "user" as const, content: "Diga 'olá' em 3 idiomas." }] };

async function main() {
  const casos: [string, Anthropic.MessageCreateParamsNonStreaming, Anthropic.RequestOptions?][] = [
    ["chamada normal", { ...base, model: "claude-opus-5-5", output_config: { effort: "low" } }],
    ["modelo inexistente", { ...base, model: "claude-modelo-que-nao-existe" }],
    ["max_tokens pequeno demais", { ...base, model: "claude-opus-5-5", max_tokens: 5, output_config: { effort: "low" } }],
    ["timeout de 1 ms", { ...base, model: "claude-opus-5-5" }, { timeout: 1, maxRetries: 0 }],
  ];

  for (const [nome, params, opcoes] of casos) {
    console.log(`\n▶ ${nome}`);
    const r = await perguntar(params, opcoes);
    if (r.ok) console.log(`  ok: ${r.texto.slice(0, 120)}`);
    else console.log(`  ${r.tipo} · tentar de novo? ${r.tentarDeNovo ? "sim" : "não"}\n  ${r.detalhe.slice(0, 160)}`);
  }
}

main();
