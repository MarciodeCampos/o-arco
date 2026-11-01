/**
 * Lab 1.7 — Primeira chamada a um LLM em TypeScript, medindo tokens e custo.
 *
 * Pré-requisitos:
 *   npm install
 *   export ANTHROPIC_API_KEY="sua-chave"
 *
 * Rode:
 *   npx tsx 04-primeira-chamada.ts
 *   npx tsx 04-primeira-chamada.ts "O que é uma janela de contexto?"
 */
import Anthropic from "@anthropic-ai/sdk";

const MODELO = process.env.MODELO ?? "claude-opus-5-5";

// US$ por 1M de tokens [entrada, saída], conferido em nov/2026. Preços mudam.
const PRECOS: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

const pergunta = process.argv.slice(2).join(" ") || "Em 3 frases: o que é um token em um LLM?";

const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

async function main() {
  let resposta;
  try {
    resposta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 2000,
      system:
        "Você é um professor de engenharia de IA. Responda em português do Brasil, de forma clara e curta.",
      messages: [{ role: "user", content: pergunta }],
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) {
      throw new Error("Chave inválida ou ausente. Defina ANTHROPIC_API_KEY.");
    } else if (erro instanceof Anthropic.RateLimitError) {
      throw new Error("Limite de requisições atingido. Tente de novo em instantes.");
    } else if (erro instanceof Anthropic.APIError) {
      throw new Error(`Erro da API (${erro.status}): ${erro.message}`);
    }
    throw erro;
  }

  if (resposta.stop_reason === "refusal") {
    console.error("O modelo recusou a solicitação.");
    return;
  }
  if (resposta.stop_reason === "max_tokens") console.warn("[aviso] resposta cortada por max_tokens\n");

  for (const bloco of resposta.content) {
    if (bloco.type === "text") console.log(bloco.text);
  }

  const { input_tokens, output_tokens } = resposta.usage;
  console.log("\n--- uso ---");
  console.log(`modelo:          ${resposta.model}`);
  console.log(`tokens entrada:  ${input_tokens}`);
  console.log(`tokens saída:    ${output_tokens}`);

  const preco = PRECOS[resposta.model];
  if (preco) {
    const custo = (input_tokens / 1e6) * preco[0] + (output_tokens / 1e6) * preco[1];
    console.log(`custo estimado:  US$ ${custo.toFixed(6)}`);
    console.log(`1.000 chamadas:  US$ ${(custo * 1000).toFixed(2)}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
