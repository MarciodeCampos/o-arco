/**
 * Lab 2.4 — Saída estruturada com Zod: texto livre entra, objeto tipado sai.
 *
 *   npx tsx 02-saida-estruturada.ts
 *   npx tsx 02-saida-estruturada.ts ../dados/email_cliente_2.txt
 */
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const Chamado = z.object({
  nome_cliente: z.string().nullable().describe("Nome de quem escreveu, se aparecer"),
  email_cliente: z.string().nullable(),
  categoria: z.enum(["cobranca", "bug", "duvida", "cancelamento", "elogio", "outro"]),
  prioridade: z
    .enum(["baixa", "media", "alta", "critica"])
    .describe("critica = sistema fora do ar ou perda de dinheiro"),
  resumo: z.string().describe("Uma frase, no máximo 20 palavras"),
  produtos_citados: z.array(z.string()),
  pede_reembolso: z.boolean(),
  sentimento: z.number().int().describe("De -2 (muito irritado) a 2 (muito satisfeito)"),
});
type Chamado = z.infer<typeof Chamado>;

const arquivo = process.argv[2] ?? "../dados/email_cliente_1.txt";
const mensagem = readFileSync(arquivo, "utf-8");

const client = new Anthropic();

async function main() {
  const resposta = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    system: "Você classifica mensagens de clientes para a equipe de suporte. Extraia apenas o que está no texto.",
    messages: [{ role: "user", content: `<email>\n${mensagem}\n</email>\n\nExtraia o chamado deste e-mail.` }],
    output_config: { effort: "low", format: zodOutputFormat(Chamado) },
  });

  if (resposta.stop_reason === "refusal") throw new Error("O modelo recusou a solicitação.");
  const chamado: Chamado | null = resposta.parsed_output;
  if (!chamado) throw new Error("Não foi possível interpretar a resposta.");

  console.log(JSON.stringify(chamado, null, 2));
  if (chamado.prioridade === "alta" || chamado.prioridade === "critica") {
    console.log(`\n🚨 Encaminhar para o plantão: ${chamado.resumo}`);
  }
  if (chamado.pede_reembolso) console.log("💸 Abrir fluxo de reembolso");
  console.log(`\n[${resposta.usage.input_tokens} tokens in / ${resposta.usage.output_tokens} out]`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
