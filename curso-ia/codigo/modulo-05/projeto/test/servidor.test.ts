/**
 * Testa o servidor MCP como um cliente real o veria, mas em memória:
 * sem processo, sem rede, sem chave de API. É assim que se testa um servidor MCP.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { criarIndiceEmMemoria, type Indice } from "../src/indice.js";
import { criarServidor } from "../src/servidor.js";

let indice: Indice;
let cliente: Client;
const eventos: { ferramenta: string; ok: boolean }[] = [];

before(async () => {
  indice = await criarIndiceEmMemoria("hash");
  const servidor = criarServidor(indice, (e) => eventos.push(e));
  const [ladoCliente, ladoServidor] = InMemoryTransport.createLinkedPair();
  await servidor.connect(ladoServidor);
  cliente = new Client({ name: "teste", version: "0" });
  await cliente.connect(ladoCliente);
});
after(async () => {
  await cliente.close();
  await indice.banco.fechar();
});

const texto = (r: unknown) => ((r as { content: { text: string }[] }).content[0]?.text ?? "");

test("anuncia as três ferramentas, com descrição e schema", async () => {
  const { tools } = await cliente.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["buscar_documentacao", "ler_secao", "listar_documentos"]);
  const busca = tools.find((t) => t.name === "buscar_documentacao")!;
  assert.ok(busca.description!.length > 50, "descrição curta demais para o modelo decidir quando usar");
  assert.deepEqual(busca.inputSchema.required, ["pergunta"]);
  assert.equal(busca.annotations?.readOnlyHint, true);
});

test("buscar_documentacao devolve texto para o modelo e dados estruturados para código", async () => {
  const r = await cliente.callTool({ name: "buscar_documentacao", arguments: { pergunta: "frete grátis acima de quanto?", k: 3 } });
  assert.ok(!r.isError);
  assert.match(texto(r), /\[entregas#frete-gratis\]/);
  const estruturado = r.structuredContent as { resultados: { id: string }[] };
  assert.equal(estruturado.resultados.length, 3);
});

test("argumentos inválidos são recusados pelo schema", async () => {
  const r = await cliente.callTool({ name: "buscar_documentacao", arguments: { pergunta: "oi", k: 50 } });
  assert.equal(r.isError, true);
});

test("ler_secao: id inexistente vira erro legível, com sugestões", async () => {
  const r = await cliente.callTool({ name: "ler_secao", arguments: { id: "entregas#prazo" } });
  assert.equal(r.isError, true);
  assert.match(texto(r), /não existe.*entregas#prazos-de-entrega/s);
});

test("ler_secao: id válido devolve o texto", async () => {
  const r = await cliente.callTool({ name: "ler_secao", arguments: { id: "plano-filtro-em-dia#pausar-a-assinatura" } });
  assert.match(texto(r), /3 meses por ano/);
});

test("listar_documentos (ferramenta sem parâmetros)", async () => {
  const r = await cliente.callTool({ name: "listar_documentos", arguments: {} });
  assert.match(texto(r), /^app-brisa-casa: /m);
});

test("recursos: lista e lê docs://{documento}", async () => {
  const { resources } = await cliente.listResources();
  assert.equal(resources.length, 6);
  const r = await cliente.readResource({ uri: "docs://entregas" });
  assert.match((r.contents[0] as { text: string }).text, /^# Entregas e Frete/);
});

test("prompt de atendimento inclui a pergunta delimitada", async () => {
  const p = await cliente.getPrompt({ name: "atendimento", arguments: { pergunta: "Cadê meu pedido?" } });
  assert.match((p.messages[0].content as { text: string }).text, /<mensagem>\nCadê meu pedido\?\n<\/mensagem>/);
});

test("toda chamada de ferramenta passa pela auditoria, com sucesso ou falha", () => {
  assert.ok(eventos.some((e) => e.ferramenta === "ler_secao" && !e.ok));
  assert.ok(eventos.some((e) => e.ferramenta === "buscar_documentacao" && e.ok));
});
