/** Monta o sistema de atendimento: dois especialistas e o supervisor. */
import type Anthropic from "@anthropic-ai/sdk";
import type { Aprovador } from "./agente.js";
import { criarLoja } from "./ferramentas.js";
import { MemoriaDeClientes } from "./memoria.js";
import { Supervisor } from "./supervisor.js";
import type { Evento } from "./tipos.js";

export function montarAtendimento(
  client: Anthropic,
  opcoes: { cliente: string; aprovar?: Aprovador; aoEvento?: (e: Evento) => void; memoria?: MemoriaDeClientes },
) {
  const loja = criarLoja();
  const memoria = opcoes.memoria ?? new MemoriaDeClientes();
  const porNome = (...nomes: string[]) => loja.ferramentas.filter((f) => nomes.includes(f.nome));

  const contexto =
    `Cliente autenticado: ${opcoes.cliente}. Só trate de pedidos deste cliente.\n` +
    `Notas de atendimentos anteriores:\n${memoria.lembrar(opcoes.cliente)}`;

  const supervisor = new Supervisor(
    client,
    [
      {
        nome: "pedidos",
        quandoUsar: "status, rastreio, cancelamento ou problema com um pedido específico",
        config: {
          sistema:
            "Você é o especialista em pedidos de uma loja online. Responda em português, de forma breve.\n" +
            "Antes de cancelar, confirme que o pedido é do cliente e está em separação. Se o caso exigir " +
            "análise humana (produto com defeito, reembolso parcial), abra um chamado.\n\n" + contexto,
          ferramentas: [...porNome("consultar_pedido", "listar_pedidos_do_cliente", "abrir_chamado", "cancelar_pedido"), memoria.ferramenta(opcoes.cliente)],
          aprovar: opcoes.aprovar,
          aoEvento: opcoes.aoEvento,
        },
      },
      {
        nome: "duvidas",
        quandoUsar: "dúvidas gerais sobre a loja que não envolvem um pedido específico",
        config: {
          sistema:
            "Você responde dúvidas gerais de clientes de uma loja online, em português e de forma breve. " +
            "Você não tem acesso a pedidos: se o cliente falar de um pedido específico, diga que vai " +
            "encaminhar e abra um chamado.\n\n" + contexto,
          ferramentas: porNome("abrir_chamado"), // menor privilégio: sem cancelar, sem consultar
          aoEvento: opcoes.aoEvento,
        },
      },
    ],
    "duvidas",
  );
  return { supervisor, loja, memoria };
}
