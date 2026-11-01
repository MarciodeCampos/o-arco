/**
 * Atendimento com agentes, no terminal, com aprovação humana de verdade.
 *
 *   npm run atender -- "Quero cancelar o pedido 4821, comprei errado"
 *   npm run atender -- --cliente bruno@exemplo.com "Cadê meu pedido?"
 *
 * Cada evento da trajetória é impresso e gravado em trajetorias/<data>.jsonl.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { MemoriaDeClientes } from "./memoria.js";
import { montarAtendimento } from "./montagem.js";
import type { Evento } from "./tipos.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { cliente: { type: "string", default: "ana@exemplo.com" } },
});

function mostrar(e: Evento) {
  switch (e.tipo) {
    case "inicio": return console.log(`\n▶ agente "${e.agente}"`);
    case "texto": return console.log(`  💬 ${e.texto.replace(/\n/g, "\n     ")}`);
    case "chamada": return console.log(`  → ${e.ferramenta}(${JSON.stringify(e.args)})`);
    case "resultado": return console.log(`    ${e.ok ? "✓" : "✗"} ${e.resumo}`);
    case "aprovacao": return console.log(`  ${e.aprovada ? "✅ aprovado" : "⛔ negado"} pelo humano`);
    case "poda": return console.log(`  ✂ ${e.resultadosPodados} resultados antigos podados do contexto`);
    case "fim": return console.log(`\n■ ${e.motivo} · ${e.passos} passos · US$ ${e.custoUsd.toFixed(4)}`);
  }
}

async function main() {
  const pedido = positionals.join(" ") || "Quero cancelar o pedido 4821, comprei o modelo errado.";
  mkdirSync("trajetorias", { recursive: true });
  const arquivo = `trajetorias/${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.jsonl`;
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const { supervisor } = montarAtendimento(new Anthropic(), {
    cliente: values.cliente!,
    memoria: new MemoriaDeClientes("memoria.json"),
    aoEvento: (e) => {
      mostrar(e);
      appendFileSync(arquivo, JSON.stringify(e) + "\n");
    },
    aprovar: async ({ ferramenta, args }) => {
      const r = await rl.question(`\n  ⚠ O agente quer executar ${ferramenta}(${JSON.stringify(args)}). Aprovar? [s/N] `);
      return r.trim().toLowerCase() === "s";
    },
  });

  console.log(`Cliente: ${values.cliente}\nPedido: ${pedido}`);
  const r = await supervisor.atender(pedido);
  console.log(`\nResposta ao cliente (via especialista "${r.especialista}"):\n${r.resposta}\n\ntrajetória em ${arquivo}`);
  rl.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
