/**
 * Lab 2.6 — Streaming: mostrar a resposta enquanto ela é gerada.
 *
 *   npx tsx 04-streaming.ts
 *   npx tsx 04-streaming.ts "Escreva um conto de 300 palavras sobre um robô que aprende a cozinhar"
 *
 * Mede duas métricas de UX: tempo até o primeiro token (TTFT) e tempo total.
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const pedido =
  process.argv.slice(2).join(" ") || "Explique em 4 parágrafos curtos por que streaming melhora a experiência de um chat.";

async function main() {
  const inicio = performance.now();
  let primeiroToken: number | undefined;

  const stream = client.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    messages: [{ role: "user", content: pedido }],
    output_config: { effort: "low" },
  });

  // O evento "text" entrega cada pedaço de texto assim que chega.
  stream.on("text", (pedaco) => {
    primeiroToken ??= performance.now();
    process.stdout.write(pedaco);
  });

  // finalMessage() espera o fim e devolve a mensagem completa (com usage e stop_reason).
  const final = await stream.finalMessage();
  const fim = performance.now();

  console.log("\n\n--- métricas ---");
  if (primeiroToken) console.log(`tempo até o 1º token: ${((primeiroToken - inicio) / 1000).toFixed(2)}s`);
  console.log(`tempo total:          ${((fim - inicio) / 1000).toFixed(2)}s`);
  console.log(`tokens de saída:      ${final.usage.output_tokens}`);
  console.log(`stop_reason:          ${final.stop_reason}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
