/**
 * Lab 2.2 — Chat de terminal com histórico (versão TypeScript).
 *
 *   npx tsx 01-chat-terminal.ts
 *   ESFORCO=high npx tsx 01-chat-terminal.ts
 *
 * Comandos: /custo  /limpar  /sair
 */
import { createInterface } from "node:readline/promises";
import Anthropic from "@anthropic-ai/sdk";

const MODELO = process.env.MODELO ?? "claude-opus-5-5";
const ESFORCO = (process.env.ESFORCO ?? "low") as "low" | "medium" | "high" | "xhigh" | "max";
const PRECOS: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
const SISTEMA = `Você é um mentor de engenharia de software.
Responda em português do Brasil, de forma direta. Use exemplos de código curtos quando ajudar.
Se não souber algo, diga que não sabe.`;

const client = new Anthropic();
const historico: Anthropic.Beta.BetaMessageParam[] = [];
let totalIn = 0;
let totalOut = 0;

const custo = () => {
  const [pIn, pOut] = PRECOS[MODELO] ?? [0, 0];
  return (totalIn / 1e6) * pIn + (totalOut / 1e6) * pOut;
};

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "você › " });
  console.log(`Chat com ${MODELO} (esforço ${ESFORCO}). /sair para terminar.\n`);
  rl.prompt();

  // Cada linha digitada é uma volta do loop; Ctrl+D (fim da entrada) encerra.
  for await (const linha of rl) {
    const entrada = linha.trim();
    if (!entrada) {
      rl.prompt();
      continue;
    }
    if (entrada === "/sair") break;
    if (entrada === "/limpar") {
      historico.length = 0;
      console.log("(histórico apagado)\n");
      rl.prompt();
      continue;
    }
    if (entrada === "/custo") {
      console.log(`  entrada ${totalIn} · saída ${totalOut} · US$ ${custo().toFixed(5)}\n`);
      rl.prompt();
      continue;
    }

    historico.push({ role: "user", content: entrada });
    try {
      const r = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 8000,
        system: SISTEMA,
        messages: historico,
        output_config: { effort: ESFORCO },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (r.stop_reason === "refusal") {
        historico.pop();
        console.log("[o modelo recusou essa mensagem]\n");
        rl.prompt();
        continue;
      }
      historico.push({ role: "assistant", content: r.content });
      const texto = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      totalIn += r.usage.input_tokens;
      totalOut += r.usage.output_tokens;
      console.log(`\nmentor › ${texto}\n`);
      console.log(`  [${r.usage.input_tokens} in / ${r.usage.output_tokens} out · conversa: US$ ${custo().toFixed(5)}]\n`);
    } catch (erro) {
      historico.pop();
      console.log(`[erro] ${erro instanceof Error ? erro.message : erro}\n`);
    }
    rl.prompt();
  }
  rl.close();
  console.log(`\nTotal: US$ ${custo().toFixed(5)}`);
}

main();
