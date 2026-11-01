/**
 * Um assistente que usa o servidor MCP como fonte de ferramentas.
 *
 *   npm run assistente -- "Posso pausar a assinatura durante uma viagem?"
 *
 * Fluxo: inicia o servidor MCP (stdio) → descobre as ferramentas → converte para o
 * formato de ferramentas da API → loop de tool calling (Módulo 2) → cada chamada vai
 * para o servidor MCP. O assistente não conhece o RAG: só o protocolo.
 * Trocar o servidor por outro (um CRM, um banco de dados) não muda este código.
 */
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MODELO = process.env.MODELO ?? "claude-opus-5-5";

/** Converte uma ferramenta MCP para o formato da Messages API. */
export function paraFerramentaDaApi(f: { name: string; description?: string; inputSchema: Record<string, unknown> }): Anthropic.Tool {
  return {
    name: f.name,
    description: f.description ?? "",
    input_schema: f.inputSchema as Anthropic.Tool.InputSchema,
  };
}

/** Converte o resultado MCP em texto para o tool_result. */
export function textoDoResultado(r: unknown): string {
  const blocos = ((r as { content?: unknown }).content ?? []) as { type: string; text?: string }[];
  return blocos.map((b) => (b.type === "text" ? b.text ?? "" : `[${b.type}]`)).join("\n");
}

export async function conversar(mcp: Client, client: Anthropic, pergunta: string, log = console.log) {
  const { tools } = await mcp.listTools();
  const ferramentas = tools.map(paraFerramentaDaApi);
  const mensagens: Anthropic.MessageParam[] = [{ role: "user", content: pergunta }];
  let resposta: Anthropic.Message | undefined;

  for (let rodada = 1; rodada <= 6; rodada++) {
    resposta = await client.messages.create({
      model: MODELO,
      max_tokens: 4000,
      system:
        "Você é o assistente de suporte da Brisa. Responda em português, em até 5 frases, usando apenas o que as " +
        "ferramentas devolverem, e cite os ids dos trechos entre colchetes. Se não encontrar, diga isso.",
      tools: ferramentas,
      messages: mensagens,
      output_config: { effort: "low" },
    });
    mensagens.push({ role: "assistant", content: resposta.content });
    if (resposta.stop_reason !== "tool_use") break;

    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const bloco of resposta.content) {
      if (bloco.type !== "tool_use") continue;
      log(`  → ${bloco.name}(${JSON.stringify(bloco.input)})`);
      const r = await mcp.callTool({ name: bloco.name, arguments: bloco.input as Record<string, unknown> });
      resultados.push({ type: "tool_result", tool_use_id: bloco.id, content: textoDoResultado(r), is_error: Boolean(r.isError) });
    }
    mensagens.push({ role: "user", content: resultados });
  }
  return resposta?.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("") ?? "";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pergunta = process.argv.slice(2).join(" ") || "Posso pausar a assinatura de filtros durante uma viagem?";
  const mcp = new Client({ name: "assistente-brisa", version: "1.0.0" });
  await mcp.connect(new StdioClientTransport({ command: "npx", args: ["tsx", "src/stdio.ts"], stderr: "inherit" }));
  try {
    console.log(`Pergunta: ${pergunta}\n`);
    const texto = await conversar(mcp, new Anthropic(), pergunta);
    console.log(`\n${texto}`);
  } finally {
    await mcp.close();
  }
}
