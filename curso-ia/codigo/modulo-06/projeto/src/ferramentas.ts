/**
 * Ferramentas de um atendimento de loja. O "banco de dados" é um objeto em memória
 * para os testes serem determinísticos; troque pelos seus sistemas reais (ou por um
 * servidor MCP, Módulo 5) sem mudar o agente.
 */
import { z } from "zod";
import { definirFerramenta, type Ferramenta } from "./tipos.js";

export interface Pedido {
  cliente: string;
  itens: number;
  peso_kg: number;
  status: "separando" | "enviado" | "entregue" | "cancelado";
  valor: number;
}

export function criarLoja() {
  const pedidos: Record<string, Pedido> = {
    "4821": { cliente: "ana@exemplo.com", itens: 3, peso_kg: 2.4, status: "separando", valor: 389.7 },
    "4822": { cliente: "bruno@exemplo.com", itens: 1, peso_kg: 0.6, status: "enviado", valor: 59.9 },
    "4823": { cliente: "ana@exemplo.com", itens: 2, peso_kg: 5.1, status: "entregue", valor: 899.0 },
  };
  const chamados: { id: string; pedido: string; assunto: string }[] = [];

  const ferramentas: Ferramenta[] = [
    definirFerramenta({
      nome: "consultar_pedido",
      descricao: "Busca um pedido pelo número. Devolve cliente, itens, peso, status e valor.",
      parametros: z.object({ numero: z.string().regex(/^\d+$/, "só dígitos") }),
      risco: "leitura",
      executar: ({ numero }) => {
        const p = pedidos[numero];
        if (!p) throw new Error(`Pedido ${numero} não encontrado`);
        return p;
      },
    }),
    definirFerramenta({
      nome: "listar_pedidos_do_cliente",
      descricao: "Lista os números e status dos pedidos de um cliente, pelo e-mail.",
      parametros: z.object({ email: z.string().email() }),
      risco: "leitura",
      executar: ({ email }) =>
        Object.entries(pedidos)
          .filter(([, p]) => p.cliente === email)
          .map(([numero, p]) => ({ numero, status: p.status, valor: p.valor })),
    }),
    definirFerramenta({
      nome: "abrir_chamado",
      descricao: "Abre um chamado para a equipe humana de suporte. Use quando o caso exigir análise humana.",
      parametros: z.object({ pedido: z.string(), assunto: z.string().min(10).max(300) }),
      risco: "escrita",
      executar: ({ pedido, assunto }) => {
        const id = `CH-${1000 + chamados.length + 1}`;
        chamados.push({ id, pedido, assunto });
        return { chamado: id };
      },
    }),
    definirFerramenta({
      nome: "cancelar_pedido",
      descricao: "Cancela um pedido que ainda está em separação. Reembolso integral.",
      parametros: z.object({ numero: z.string(), motivo: z.string().min(3) }),
      risco: "irreversivel",
      executar: ({ numero }) => {
        const p = pedidos[numero];
        if (!p) throw new Error(`Pedido ${numero} não encontrado`);
        if (p.status !== "separando") throw new Error(`Pedido ${numero} está "${p.status}": só pedidos em separação podem ser cancelados`);
        p.status = "cancelado";
        return { cancelado: numero, reembolso: p.valor };
      },
    }),
  ];

  return { ferramentas, pedidos, chamados };
}
