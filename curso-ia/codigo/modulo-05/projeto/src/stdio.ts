/**
 * Servidor MCP pelo transporte stdio: o cliente (Claude Code, Claude Desktop, IDE,
 * o assistente deste projeto) inicia este processo e conversa por stdin/stdout.
 *
 *   npm run servidor:stdio
 *
 * ATENÇÃO: no stdio, o stdout é o canal do protocolo. Qualquer console.log
 * corrompe a comunicação. Use console.error para mensagens de diagnóstico.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { abrirIndiceDoModulo4 } from "./indice.js";
import { criarServidor } from "./servidor.js";

async function main() {
  const indice = await abrirIndiceDoModulo4();
  const servidor = criarServidor(indice);
  await servidor.connect(new StdioServerTransport());
  console.error(`[documentacao-brisa] pronto (stdio, embedder ${indice.embedder.nome})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
