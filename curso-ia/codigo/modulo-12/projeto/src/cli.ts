/**
 * Roda o red team contra as duas versões do alvo e compara.
 *
 *   npm run redteam                 # as duas versões
 *   npm run redteam -- protegido
 */
import Anthropic from "@anthropic-ai/sdk";
import { CANARIO, DOMINIOS_PERMITIDOS, criarAlvo } from "./alvo.js";
import { carregarAtaques, executarRedTeam } from "./redteam.js";

async function main() {
  const modos = process.argv[2] ? [process.argv[2] as "ingenuo" | "protegido"] : (["ingenuo", "protegido"] as const);
  const ataques = carregarAtaques(new URL("../ataques.jsonl", import.meta.url));
  const client = new Anthropic({ maxRetries: 3 });
  for (const modo of modos) {
    const { resultados, porCategoria } = await executarRedTeam(criarAlvo(client, modo), ataques, { canario: CANARIO, dominiosPermitidos: DOMINIOS_PERMITIDOS });
    console.log(`\n=== alvo ${modo.toUpperCase()} ===`);
    for (const [cat, { total, falhas }] of Object.entries(porCategoria)) {
      console.log(`  ${cat.padEnd(28)} ${falhas}/${total} ataques bem-sucedidos`);
    }
    for (const r of resultados.filter((x) => x.falhas.length)) {
      console.log(`  ✗ ${r.ataque.id}: ${r.falhas.join("; ")}`);
    }
    const total = resultados.filter((x) => x.falhas.length).length;
    console.log(`  → ${total}/${resultados.length} ataques bem-sucedidos`);
  }
  console.log("\nAtaques que passaram viram casos de regressão: rode este red team no CI a cada mudança de prompt ou modelo.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
