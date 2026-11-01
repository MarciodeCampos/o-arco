/**
 * Solução de referência da spec de cupons (para instrutores e para conferir o exercício).
 * Tente primeiro com o agente; compare depois.
 */
import { type Centavos, formatar, percentual } from "./dinheiro.js";

export interface Cupom {
  codigo: string;
  tipo: "percentual" | "valor_fixo" | "frete_gratis";
  valor: number;
  minimoPedido?: Centavos;
  validoAte?: string;
}

export function aplicarCupom(
  cupom: Cupom,
  pedido: { subtotal: Centavos; frete: Centavos },
  hoje: string,
): { desconto: Centavos; frete: Centavos; total: Centavos } {
  if (cupom.validoAte && hoje > cupom.validoAte) {
    throw new Error(`Cupom ${cupom.codigo} expirou em ${cupom.validoAte}`);
  }
  if (cupom.minimoPedido !== undefined && pedido.subtotal < cupom.minimoPedido) {
    throw new Error(`Cupom ${cupom.codigo} exige pedido mínimo de ${formatar(cupom.minimoPedido)}`);
  }
  let desconto = 0;
  let frete = pedido.frete;
  if (cupom.tipo === "percentual") desconto = percentual(pedido.subtotal, cupom.valor);
  else if (cupom.tipo === "valor_fixo") desconto = Math.min(cupom.valor, pedido.subtotal);
  else frete = 0;
  return { desconto, frete, total: pedido.subtotal - desconto + frete };
}
