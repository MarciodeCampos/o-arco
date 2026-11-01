/**
 * Teste de ponta a ponta no navegador real (Playwright + Chromium), com a API falsa.
 * Para rodar: npm i -D playwright && npx playwright install chromium
 * Se o Playwright não estiver instalado, o teste é pulado.
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { criarServidor } from "../src/servidor.js";
import { PNG_1PX, apiFalsa } from "./api-falsa.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let playwright: any = null;
try {
  playwright = createRequire(import.meta.url)("playwright");
} catch {
  playwright = null;
}

test("usuário conversa com streaming, para uma geração e analisa uma imagem", { skip: !playwright && "Playwright não instalado" }, async () => {
  const { client } = apiFalsa({ textoChat: "Claro! O prazo para o interior de Minas é de 4 a 7 dias úteis.", atrasoMs: 15 });
  const servidor = criarServidor(client, { porMinuto: 1000 });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/`;
  const navegador = await playwright.chromium.launch();
  const erros: string[] = [];
  try {
    const pagina = await navegador.newPage();
    pagina.on("pageerror", (e: Error) => erros.push(e.message));
    pagina.on("console", (m: { type(): string; text(): string }) => m.type() === "error" && erros.push(m.text()));
    await pagina.goto(url);

    // chat com streaming
    await pagina.fill("#entrada", "Qual o prazo para o interior de MG?");
    await pagina.keyboard.press("Enter");
    await pagina.locator(".msg.assistant").getByText("4 a 7 dias úteis").waitFor();
    await pagina.locator("#status-chat").getByText(/Pronto/).waitFor();
    assert.equal(await pagina.locator(".msg").count(), 2);

    // botão parar
    await pagina.fill("#entrada", "Conte uma história longa");
    await pagina.keyboard.press("Enter");
    await pagina.locator("#parar").click();
    await pagina.locator("#status-chat").getByText("Cancelado.").waitFor();

    // imagem
    const arquivo = join(tmpdir(), "cupom-teste.png");
    writeFileSync(arquivo, Buffer.from(PNG_1PX, "base64"));
    await pagina.setInputFiles("#arquivo", arquivo);
    await pagina.click("#analisar");
    await pagina.locator("#r-valores").getByText("R$ 27,30").waitFor();
    assert.equal(await pagina.locator("#r-tipo").textContent(), "nota_fiscal");

    assert.deepEqual(erros, [], "sem erros no console (inclui violações da política de segurança)");
  } finally {
    await navegador.close();
    servidor.close();
  }
});
