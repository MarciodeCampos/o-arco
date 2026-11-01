/**
 * Executor de evals do extrator de recibos.
 *
 *   npm run eval                                     # todos os casos, 1 repetição
 *   npm run eval -- --reps 3                         # 3 repetições por caso
 *   npm run eval -- --modelo claude-haiku-5-5 --reps 3
 *   npm run eval -- --tag problema --juiz            # só casos com a tag, com LLM-juiz
 *   npm run eval -- --limiar 0.9                     # sai com erro se a taxa < 90% (para o CI)
 *
 * Chama o extrator REAL do Módulo 2: o eval mede exatamente o que vai para produção.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { custoChamada } from "../../../modulo-02/projeto/src/custo.js";
import { extrairRecibo } from "../../../modulo-02/projeto/src/extrator.js";
import { avaliar, casoPassou } from "./avaliadores.js";
import { media, percentil, pisoDeRuido, wilson } from "./estatistica.js";
import { MODELO_JUIZ, julgarExplicacao } from "./juiz.js";
import type { Caso, ErroInfra, Linha } from "./tipos.js";

const { values: args } = parseArgs({
  options: {
    modelo: { type: "string", default: "claude-opus-5-5" },
    reps: { type: "string", default: "1" },
    tag: { type: "string" },
    concorrencia: { type: "string", default: "4" },
    limiar: { type: "string" },
    juiz: { type: "boolean", default: false },
    casos: { type: "string", default: "casos/casos.jsonl" },
    saida: { type: "string", default: "resultados" },
  },
});

const modelo = args.modelo!;
const reps = Number(args.reps);
const casos: Caso[] = readFileSync(args.casos!, "utf-8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))
  .filter((c: Caso) => !args.tag || c.tags.includes(args.tag));

function classificar(erro: unknown): ErroInfra["classe"] {
  if (erro instanceof Anthropic.RateLimitError) return "rate_limit";
  if (erro instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (erro instanceof Anthropic.APIConnectionError) return "conexao";
  if (erro instanceof Anthropic.InternalServerError) return "servidor";
  return "outro";
}

/** Executa tarefas com no máximo `limite` em paralelo. */
async function emParalelo<T>(tarefas: (() => Promise<T>)[], limite: number): Promise<T[]> {
  const resultados: T[] = new Array(tarefas.length);
  let proxima = 0;
  const trabalhador = async () => {
    while (proxima < tarefas.length) {
      const i = proxima++;
      resultados[i] = await tarefas[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, tarefas.length) }, trabalhador));
  return resultados;
}

async function main() {
  if (!casos.length) throw new Error("Nenhum caso selecionado");
  const client = new Anthropic({ maxRetries: 4 });
  const linhas: Linha[] = [];
  const erros: ErroInfra[] = [];
  let custoJuiz = 0;

  console.log(`Avaliando ${casos.length} casos × ${reps} rep. com ${modelo}${args.juiz ? ` (juiz: ${MODELO_JUIZ})` : ""}\n`);

  const tarefas = casos.flatMap((caso) =>
    Array.from({ length: reps }, (_, rep) => async () => {
      const inicio = performance.now();
      try {
        const r = await extrairRecibo(client, caso.texto, modelo);
        const latenciaS = (performance.now() - inicio) / 1000;

        // O modelo que respondeu é o que pedimos? Se não, o resultado não mede o que achamos.
        const outro = r.modelosServidos.find((m) => m !== modelo);
        if (outro) {
          erros.push({ caso: caso.id, rep, classe: "modelo_trocado", mensagem: `pedido ${modelo}, servido ${outro}` });
          return;
        }

        const saida = { recibo: r.recibo, problemas: r.problemas };
        const checagens = avaliar(caso, saida);
        const linha: Linha = {
          caso: caso.id,
          tags: caso.tags,
          rep,
          modelo,
          modelosServidos: r.modelosServidos,
          tentativas: r.tentativas,
          latenciaS,
          usos: r.usos,
          custoUsd: r.usos.reduce((s, u) => s + custoChamada(u, modelo), 0),
          saida,
          checagens,
          passou: casoPassou(checagens),
        };

        if (args.juiz && caso.tags.includes("problema") && r.recibo) {
          const j = await julgarExplicacao(client, caso.nota ?? "", r.recibo.observacoes);
          custoJuiz += custoChamada(j.uso, MODELO_JUIZ);
          linha.juiz = { nota: j.aprovado, justificativa: j.justificativa };
        }
        linhas.push(linha);
        process.stdout.write(linha.passou ? "." : "F");
      } catch (erro) {
        // Erro de infraestrutura NÃO é nota zero: vai para uma lista separada.
        erros.push({ caso: caso.id, rep, classe: classificar(erro), mensagem: String(erro).slice(0, 300) });
        process.stdout.write("E");
      }
    }),
  );
  await emParalelo(tarefas, Number(args.concorrencia));
  console.log("\n");

  // ---------------------------------------------------------------- relatório
  const n = linhas.length;
  const acertos = linhas.filter((l) => l.passou).length;
  const ic = wilson(acertos, n);
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

  console.log("Por checagem:");
  const nomes = [...new Set(linhas.flatMap((l) => l.checagens.map((c) => c.nome)))];
  for (const nome of nomes) {
    const cs = linhas.flatMap((l) => l.checagens.filter((c) => c.nome === nome));
    console.log(`  ${nome.padEnd(16)} ${pct(cs.filter((c) => c.passou).length / cs.length).padStart(4)}  (${cs.length})`);
  }

  console.log("\nPor tag:");
  for (const tag of [...new Set(casos.flatMap((c) => c.tags))].sort()) {
    const ls = linhas.filter((l) => l.tags.includes(tag));
    if (ls.length) console.log(`  ${tag.padEnd(20)} ${pct(ls.filter((l) => l.passou).length / ls.length).padStart(4)}  (${ls.length})`);
  }

  const falhas = linhas.filter((l) => !l.passou);
  if (falhas.length) {
    console.log("\nFalhas:");
    for (const l of falhas) {
      const ruins = l.checagens.filter((c) => !c.passou).map((c) => `${c.nome}: ${c.detalhe}`);
      console.log(`  ${l.caso} (rep ${l.rep}) → ${ruins.join(" | ")}`);
    }
  }

  const julgadas = linhas.filter((l) => l.juiz);
  if (julgadas.length) {
    console.log(`\nLLM-juiz (qualidade da explicação): ${julgadas.filter((l) => l.juiz!.nota).length}/${julgadas.length} aprovadas`);
  }

  const custo = linhas.reduce((s, l) => s + l.custoUsd, 0);
  const lat = linhas.map((l) => l.latenciaS);
  console.log("\n--- resumo ---");
  console.log(`taxa de acerto: ${pct(ic.taxa)}  (IC 95%: ${pct(ic.inferior)} – ${pct(ic.superior)})  ·  ${acertos}/${n}`);
  console.log(`ruído aproximado com ${casos.length} casos × ${reps} rep.: ±${pct(pisoDeRuido(casos.length, reps))}`);
  console.log(`erros de infraestrutura (fora da nota): ${erros.length}`);
  console.log(`latência p50 ${percentil(lat, 0.5).toFixed(1)}s · p95 ${percentil(lat, 0.95).toFixed(1)}s`);
  console.log(`custo: US$ ${custo.toFixed(4)} (US$ ${(custo / Math.max(n, 1)).toFixed(5)} por execução) + juiz US$ ${custoJuiz.toFixed(4)}`);
  console.log(`tentativas médias por recibo: ${media(linhas.map((l) => l.tentativas)).toFixed(2)}`);

  mkdirSync(args.saida!, { recursive: true });
  const arquivo = join(args.saida!, `${new Date().toISOString().replace(/[:.]/g, "-")}_${modelo}.json`);
  writeFileSync(
    arquivo,
    JSON.stringify(
      { meta: { modelo, reps, casos: casos.length, tag: args.tag ?? null, data: new Date().toISOString() }, resumo: { acertos, n, ...ic, custo, custoJuiz, erros: erros.length }, linhas, erros },
      null,
      2,
    ),
  );
  console.log(`\nresultados salvos em ${arquivo}`);

  if (args.limiar !== undefined) {
    const limiar = Number(args.limiar);
    if (erros.length > n * 0.2) {
      console.error(`\n✗ Erros de infraestrutura demais (${erros.length}) para confiar no resultado.`);
      process.exit(2);
    }
    if (ic.taxa < limiar) {
      console.error(`\n✗ Taxa ${pct(ic.taxa)} abaixo do limiar ${pct(limiar)}.`);
      process.exit(1);
    }
    console.log(`\n✓ Taxa ${pct(ic.taxa)} ≥ limiar ${pct(limiar)}.`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
