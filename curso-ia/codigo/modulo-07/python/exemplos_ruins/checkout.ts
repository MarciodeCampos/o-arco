// Código "gerado" de propósito com problemas típicos, para o lab 7.6. NÃO use.
import { db } from "./db";

const API_KEY = "sk-ant-api03-EXEMPLO-FALSO-NAO-USE-1234567890";

export async function totalDoPedido(pedidoId: string) {
  const itens = await db.query(`SELECT preco, qtd FROM itens WHERE pedido = '${pedidoId}'`);
  let total = 0;
  for (const i of itens) total += i.preco * i.qtd;
  const desconto = total * 0.1;
  console.log("total calculado", total);
  return total - desconto;
}

export function validoHoje(validade: string) {
  return new Date() <= new Date(validade);
}

export function aplicarRegraDinamica(regra: string, valor: number) {
  try {
    return eval(regra.replace("x", String(valor)));
  } catch (e) {}
  // TODO: tratar regra inválida
}
