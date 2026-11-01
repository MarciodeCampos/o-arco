/**
 * Eval de RESPOSTAS (ponta a ponta): busca + geração. Chama a API.
 *
 *   npm run avaliar:respostas
 *   npm run avaliar:respostas -- --modo vetorial
 *   npm run avaliar:respostas -- --contexto-completo
 *
 * Checagens por pergunta:
 *  - perguntas COM resposta na documentação: respondeu (não disse "não encontrei"),
 *    citou pelo menos um trecho relevante e contém os fatos-chave esperados;
 *  - perguntas SEM resposta: disse que não encontrou (não inventou).
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { Banco } from "./banco.js";
import { buscar, type Modo } from "./busca.js";
import { criarEmbedder } from "./embeddings.js";
import { MODELO, responder } from "./resposta.js";

interface Pergunta {
  id: string;
  pergunta: string;
  relevantes: string[];
  /** Trechos que precisam aparecer na resposta (comparação sem acento/maiúscula). */
  fatos?: string[];
  tags: string[];
}

const { values: args } = parseArgs({
  options: {
    modo: { type: "string", default: "hibrida" },
    k: { type: "string", default: "5" },
    "contexto-completo": { type: "boolean", default: false },
    banco: { type: "string", default: ".banco" },
    perguntas: { type: "string", default: "avaliacao/perguntas.jsonl" },
  },
});

const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
const PRECO = { entrada: 4, saida: 20 }; // claude-opus-5-5, US$/1M tokens (nov/2026)

async function main() {
  const perguntas: Pergunta[] = readFileSync(args.perguntas!, "utf-8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  const banco = await Banco.abrir(args.banco);
  const nomeEmbedder = await banco.embedderIndexado();
  if (!nomeEmbedder) throw new Error("Índice não encontrado. Rode npm run indexar primeiro.");
  const embedder = criarEmbedder(nomeEmbedder);
  const todos = args["contexto-completo"] ? await banco.todos() : null;
  const client = new Anthropic({ maxRetries: 4 });

  let ok = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  const linhas: string[] = [];
  for (const p of perguntas) {
    const trechos = todos ?? (await buscar(banco, embedder, p.pergunta, args.modo as Modo, Number(args.k)));
    const r = await responder(client, p.pergunta, trechos);
    tokensIn += r.uso.input_tokens;
    tokensOut += r.uso.output_tokens;

    const problemas: string[] = [];
    if (p.relevantes.length === 0) {
      if (!r.naoEncontrou) problemas.push("deveria dizer que não encontrou");
    } else {
      if (r.naoEncontrou) problemas.push("disse que não encontrou");
      if (!r.citacoes.some((c) => p.relevantes.includes(c.fonte))) problemas.push("não citou trecho relevante");
      for (const f of p.fatos ?? []) if (!norm(r.texto).includes(norm(f))) problemas.push(`faltou "${f}"`);
    }
    if (!problemas.length) ok++;
    linhas.push(`${problemas.length ? "✗" : "✓"} ${p.id.padEnd(5)} ${p.pergunta.slice(0, 60)}${problemas.length ? `\n      ${problemas.join("; ")}\n      resposta: ${r.texto.replace(/\s+/g, " ").slice(0, 160)}` : ""}`);
    process.stdout.write(problemas.length ? "F" : ".");
  }
  await banco.fechar();
  console.log("\n\n" + linhas.join("\n"));
  const custo = (tokensIn * PRECO.entrada + tokensOut * PRECO.saida) / 1e6;
  console.log(`\n${ok}/${perguntas.length} corretas (${((ok / perguntas.length) * 100).toFixed(0)}%) · modo ${args["contexto-completo"] ? "contexto completo" : args.modo} · ${MODELO}`);
  console.log(`tokens: ${tokensIn} entrada, ${tokensOut} saída · custo aprox. US$ ${custo.toFixed(4)} (US$ ${(custo / perguntas.length).toFixed(5)} por pergunta)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
