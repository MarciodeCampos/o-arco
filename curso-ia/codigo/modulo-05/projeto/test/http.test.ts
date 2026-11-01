/**
 * Teste do transporte HTTP de verdade (porta local), com autenticação,
 * limite de taxa e auditoria.
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { criarServidorHttp } from "../src/http.js";
import { criarIndiceEmMemoria, type Indice } from "../src/indice.js";
import { LimitadorDeTaxa, carregarTokens } from "../src/protecoes.js";

const TOKEN = "token-de-teste-bem-comprido-123";
let indice: Indice;
let http: Server;
let url: URL;
const auditoria: { ferramenta: string; cliente?: string }[] = [];

before(async () => {
  indice = await criarIndiceEmMemoria("hash");
  http = criarServidorHttp(indice, {
    tokens: carregarTokens(`${TOKEN}:time-suporte`),
    limitador: new LimitadorDeTaxa(8, 0.001), // 8 requisições e quase nenhuma recarga
    auditar: (e) => auditoria.push(e),
  });
  await new Promise<void>((ok) => http.listen(0, "127.0.0.1", ok));
  url = new URL(`http://127.0.0.1:${(http.address() as AddressInfo).port}/mcp`);
});
after(async () => {
  http.close();
  await indice.banco.fechar();
});

async function conectar(token?: string) {
  const c = new Client({ name: "teste-http", version: "0" });
  await c.connect(
    new StreamableHTTPClientTransport(url, { requestInit: token ? { headers: { authorization: `Bearer ${token}` } } : {} }),
  );
  return c;
}

test("sem token: 401", async () => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("www-authenticate"), "Bearer");
});

test("token errado: o cliente MCP não conecta", async () => {
  await assert.rejects(conectar("token-errado-mas-bem-comprido"));
});

test("token certo: chama ferramenta e a auditoria registra o cliente", async () => {
  const c = await conectar(TOKEN);
  const r = await c.callTool({ name: "buscar_documentacao", arguments: { pergunta: "garantia do aparelho", k: 2 } });
  assert.ok(!r.isError);
  await c.close();
  assert.deepEqual(
    auditoria.filter((e) => e.ferramenta === "buscar_documentacao").map((e) => e.cliente),
    ["time-suporte"],
  );
});

test("GET não é permitido no modo sem sessão", async () => {
  const r = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(r.status, 405);
});

test("limite de taxa: depois de esgotar, 429 com Retry-After", async () => {
  let ultimo: Response | undefined;
  for (let i = 0; i < 10; i++) {
    ultimo = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: i, method: "ping" }),
    });
    if (ultimo.status === 429) break;
  }
  assert.equal(ultimo!.status, 429);
  assert.ok(Number(ultimo!.headers.get("retry-after")) > 0);
});
