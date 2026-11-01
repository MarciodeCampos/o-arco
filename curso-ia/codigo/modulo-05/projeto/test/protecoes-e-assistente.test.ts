import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { conversar, paraFerramentaDaApi } from "../src/assistente.js";
import { criarIndiceEmMemoria, type Indice } from "../src/indice.js";
import { LimitadorDeTaxa, autenticar, carregarTokens } from "../src/protecoes.js";
import { criarServidor } from "../src/servidor.js";

// ---------------------------------------------------------------- proteções
test("tokens curtos são rejeitados na configuração", () => {
  assert.throws(() => carregarTokens("abc:cliente"), /mínimo 16/);
});

test("autenticação aceita Bearer válido e recusa o resto", () => {
  const tokens = carregarTokens("um-token-com-mais-de-16:app-a,outro-token-com-mais-16:app-b");
  assert.equal(autenticar("Bearer outro-token-com-mais-16", tokens)?.clientId, "app-b");
  assert.equal(autenticar("Bearer errado-errado-errado", tokens), null);
  assert.equal(autenticar("um-token-com-mais-de-16", tokens), null); // sem "Bearer"
  assert.equal(autenticar(undefined, tokens), null);
});

test("limitador: esgota, espera, volta a permitir; clientes são independentes", () => {
  let agora = 0;
  const l = new LimitadorDeTaxa(2, 1, () => agora);
  assert.ok(l.permitir("a").ok);
  assert.ok(l.permitir("a").ok);
  assert.equal(l.permitir("a").ok, false);
  assert.ok(l.permitir("b").ok, "outro cliente não é afetado");
  agora += 1000;
  assert.ok(l.permitir("a").ok, "1 s depois, 1 ficha nova");
});

// ---------------------------------------------------------------- assistente (com API falsa)
let indice: Indice;
let mcp: Client;
before(async () => {
  indice = await criarIndiceEmMemoria("hash");
  const [c, s] = InMemoryTransport.createLinkedPair();
  await criarServidor(indice).connect(s);
  mcp = new Client({ name: "teste", version: "0" });
  await mcp.connect(c);
});
after(async () => {
  await mcp.close();
  await indice.banco.fechar();
});

test("ferramentas MCP viram ferramentas da API com o mesmo schema", async () => {
  const { tools } = await mcp.listTools();
  const f = paraFerramentaDaApi(tools.find((t) => t.name === "ler_secao")!);
  assert.equal(f.name, "ler_secao");
  assert.deepEqual(f.input_schema.required, ["id"]);
});

test("loop do assistente: o modelo pede a ferramenta, o MCP executa, o resultado volta", async () => {
  const requisicoes: { messages: Anthropic.MessageParam[] }[] = [];
  // Uma "API" falsa: 1ª resposta pede a ferramenta; 2ª responde em texto.
  const fetchFalso: typeof fetch = async (_url, init) => {
    const corpo = JSON.parse(String(init?.body));
    requisicoes.push(corpo);
    const primeira = requisicoes.length === 1;
    const msg = {
      id: `msg_${requisicoes.length}`,
      type: "message",
      role: "assistant",
      model: corpo.model,
      stop_reason: primeira ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5 },
      content: primeira
        ? [{ type: "tool_use", id: "toolu_1", name: "buscar_documentacao", input: { pergunta: "pausar assinatura", k: 2 } }]
        : [{ type: "text", text: "Pode pausar por até 3 meses [plano-filtro-em-dia#pausar-a-assinatura]." }],
    };
    return new Response(JSON.stringify(msg), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = new Anthropic({ apiKey: "teste", fetch: fetchFalso, maxRetries: 0 });

  const chamadas: string[] = [];
  const resposta = await conversar(mcp, client, "Posso pausar a assinatura?", (l) => chamadas.push(l));

  assert.match(resposta, /3 meses/);
  assert.equal(chamadas.length, 1);
  // a 2ª requisição leva o resultado real da ferramenta MCP
  const resultado = requisicoes[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
  assert.equal(resultado[0].type, "tool_result");
  assert.match(String(resultado[0].content), /\[plano-filtro-em-dia#/);
});
