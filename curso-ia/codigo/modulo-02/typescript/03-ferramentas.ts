/**
 * Lab 2.5 — Tool calling em TypeScript: o loop manual, escrito à mão.
 *
 *   npx tsx 03-ferramentas.ts
 *   npx tsx 03-ferramentas.ts "Qual o status do pedido 4822?"
 *
 * No Módulo 6 você troca este loop pelo tool runner do SDK e por frameworks de
 * agentes. Escrever à mão uma vez é o melhor jeito de entender o que eles fazem.
 */
import Anthropic from "@anthropic-ai/sdk";

const PEDIDOS: Record<string, { cliente: string; itens: number; peso_kg: number; status: string }> = {
  "4821": { cliente: "Ana Souza", itens: 3, peso_kg: 2.4, status: "separando" },
  "4822": { cliente: "Bruno Lima", itens: 1, peso_kg: 0.6, status: "enviado" },
};
const FAIXAS_CEP: Record<string, string> = { "0": "SP capital", "1": "SP interior", "2": "RJ/ES", "3": "MG", "8": "PR/SC", "9": "RS" };

// ---------------------------------------------------------------- ferramentas: código comum
function consultarPedido({ numero }: { numero: string }) {
  const pedido = PEDIDOS[numero];
  if (!pedido) throw new Error(`Pedido ${numero} não encontrado`);
  return pedido;
}

function calcularFrete({ cep, peso_kg }: { cep: string; peso_kg: number }) {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) throw new Error("CEP deve ter 8 dígitos");
  const regiao = FAIXAS_CEP[digitos[0]] ?? "outras regiões";
  const base = regiao.startsWith("SP") ? 18 : 29;
  return { regiao, valor_reais: Math.round((base + 6.5 * peso_kg) * 100) / 100, prazo_dias: base === 18 ? 3 : 6 };
}

// O input do modelo chega como `unknown`: o schema `strict` garante o formato,
// mas é você quem converte para o tipo da função.
const EXECUTORES: Record<string, (input: any) => unknown> = {
  consultar_pedido: consultarPedido,
  calcular_frete: calcularFrete,
};

const FERRAMENTAS: Anthropic.Tool[] = [
  {
    name: "consultar_pedido",
    description: "Busca um pedido pelo número. Devolve cliente, quantidade de itens, peso total em kg e status.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { numero: { type: "string", description: "Número do pedido, só dígitos" } },
      required: ["numero"],
      additionalProperties: false,
    },
  },
  {
    name: "calcular_frete",
    description: "Calcula valor e prazo de frete para um CEP de destino e um peso em kg.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        cep: { type: "string", description: "CEP de destino, com ou sem hífen" },
        peso_kg: { type: "number" },
      },
      required: ["cep", "peso_kg"],
      additionalProperties: false,
    },
  },
];

const client = new Anthropic();
const pergunta =
  process.argv.slice(2).join(" ") || "Quanto custa e quanto tempo leva para enviar o pedido 4821 para o CEP 30140-071?";

async function main() {
  const mensagens: Anthropic.MessageParam[] = [{ role: "user", content: pergunta }];
  let resposta: Anthropic.Message | undefined;

  for (let rodada = 1; rodada <= 5; rodada++) {
    resposta = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      system: "Você é o atendente de uma loja online. Use as ferramentas para responder com dados reais. Responda em português.",
      tools: FERRAMENTAS,
      messages: mensagens,
      output_config: { effort: "low" },
    });
    mensagens.push({ role: "assistant", content: resposta.content });
    if (resposta.stop_reason !== "tool_use") break;

    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const bloco of resposta.content) {
      if (bloco.type !== "tool_use") continue;
      console.log(`[rodada ${rodada}] modelo pediu: ${bloco.name}(${JSON.stringify(bloco.input)})`);
      try {
        const executor = EXECUTORES[bloco.name];
        if (!executor) throw new Error(`Ferramenta desconhecida: ${bloco.name}`);
        const saida = executor(bloco.input);
        console.log(`           resultado: ${JSON.stringify(saida)}`);
        resultados.push({ type: "tool_result", tool_use_id: bloco.id, content: JSON.stringify(saida) });
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : String(erro);
        console.log(`           erro: ${msg}`);
        resultados.push({ type: "tool_result", tool_use_id: bloco.id, content: msg, is_error: true });
      }
    }
    mensagens.push({ role: "user", content: resultados });
  }

  const texto = resposta?.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("") ?? "";
  console.log(`\nResposta final:\n${texto}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
