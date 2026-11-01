import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { assinaturaConfere, criarServidor } from "../src/servidor.js";
import { PNG_1PX, apiFalsa } from "./api-falsa.js";

let servidor: Server;
let base: string;
const api = apiFalsa({ textoChat: "Seu pedido chega amanhã." });

before(async () => {
  servidor = criarServidor(api.client, { porMinuto: 1000 });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => servidor.close());

const post = (rota: string, corpo: unknown) =>
  fetch(base + rota, { method: "POST", headers: { "content-type": "application/json" }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });

test("chat responde em SSE: pedaços de texto e um evento de fim", async () => {
  const r = await post("/api/chat", { mensagens: [{ role: "user", content: "Quando chega?" }] });
  assert.equal(r.headers.get("content-type"), "text/event-stream; charset=utf-8");
  const corpo = await r.text();
  const textos = [...corpo.matchAll(/event: texto\ndata: (.+)/g)].map((m) => JSON.parse(m[1]).pedaco);
  assert.ok(textos.length > 1, "deve chegar em vários pedaços");
  assert.equal(textos.join(""), "Seu pedido chega amanhã.");
  assert.match(corpo, /event: fim\ndata: \{"stop_reason":"end_turn"/);
});

test("o servidor controla o prompt de sistema e o modelo, não o navegador", async () => {
  const ultima = api.requisicoes.at(-1)!;
  assert.match(String(ultima.system), /assistente de uma loja/);
  assert.equal(ultima.model, "claude-opus-5-5");
});

test("validação do chat: conversa deve começar e terminar com o usuário, com limites", async () => {
  assert.equal((await post("/api/chat", { mensagens: [] })).status, 400);
  assert.equal((await post("/api/chat", { mensagens: [{ role: "assistant", content: "oi" }] })).status, 400);
  assert.equal((await post("/api/chat", { mensagens: [{ role: "user", content: "x".repeat(4001) }] })).status, 400);
  assert.equal((await post("/api/chat", "{nao é json")).status, 400);
});

test("análise de imagem devolve JSON estruturado", async () => {
  const r = await post("/api/analisar", { imagem: `data:image/png;base64,${PNG_1PX}` });
  assert.equal(r.status, 200);
  const { analise } = await r.json();
  assert.equal(analise.tipo, "nota_fiscal");
  const enviada = api.requisicoes.at(-1)! as { messages: { content: { type: string; source?: { media_type: string } }[] }[] };
  assert.equal(enviada.messages[0].content[0].source?.media_type, "image/png");
});

test("imagem com rótulo falso (diz PNG, mas não é) é recusada antes de chamar a API", async () => {
  const antes = api.requisicoes.length;
  const falsa = Buffer.from("<script>alert(1)</script>").toString("base64");
  assert.equal((await post("/api/analisar", { imagem: `data:image/png;base64,${falsa}` })).status, 415);
  assert.equal((await post("/api/analisar", { imagem: `data:image/svg+xml;base64,${falsa}` })).status, 415);
  assert.equal(api.requisicoes.length, antes, "nenhum token gasto");
});

test("corpo grande demais: 413", async () => {
  const enorme = "A".repeat(7 * 1024 * 1024);
  assert.equal((await post("/api/analisar", { imagem: `data:image/png;base64,${enorme}` })).status, 413);
});

test("arquivos estáticos com política de segurança; caminho com ../ é bloqueado", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.match(await r.text(), /<title>Assistente da Loja<\/title>/);
  assert.equal((await fetch(base + "/..%2f..%2fpackage.json")).status, 403);
});

test("limite por IP: 429 depois do limite", async () => {
  const s = criarServidor(api.client, { porMinuto: 2 });
  await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/chat`;
  const req = () => fetch(url, { method: "POST", body: "{}" });
  const status = [(await req()).status, (await req()).status, (await req()).status];
  s.close();
  assert.deepEqual(status, [400, 400, 429]);
});

test("assinatura de bytes de imagem", () => {
  assert.ok(assinaturaConfere("image/png", PNG_1PX));
  assert.ok(!assinaturaConfere("image/jpeg", PNG_1PX));
});
