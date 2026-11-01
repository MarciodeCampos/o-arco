import type { Recibo } from "./esquema.js";

const TOLERANCIA = 0.02; // centavos de arredondamento

/** Valida os dígitos verificadores de um CNPJ (14 dígitos). */
export function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((s, p, i) => s + Number(base[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(d, p1);
  const d2 = calc(d, [6, ...p1]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/**
 * Regras de negócio que o schema não expressa. O LLM pode devolver um JSON
 * perfeitamente válido e ainda assim errado: é aqui que pegamos isso.
 * Devolve a lista de problemas (vazia = tudo certo).
 */
export function validarRecibo(r: Recibo, hoje = new Date()): string[] {
  const erros: string[] = [];

  if (r.emitente.cnpj !== null && !cnpjValido(r.emitente.cnpj)) {
    erros.push(`CNPJ inválido: ${r.emitente.cnpj}`);
  }

  const data = new Date(`${r.data}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data) || Number.isNaN(data.getTime())) {
    erros.push(`Data em formato inválido: ${r.data}`);
  } else if (data > hoje) {
    erros.push(`Data no futuro: ${r.data}`);
  }

  if (r.itens.length === 0) erros.push("Nenhum item encontrado");

  for (const item of r.itens) {
    const esperado = item.quantidade * item.valor_unitario;
    if (Math.abs(esperado - item.valor_total) > TOLERANCIA) {
      erros.push(
        `Item "${item.descricao}": ${item.quantidade} × ${item.valor_unitario} = ${esperado.toFixed(2)}, mas o total do item é ${item.valor_total}`,
      );
    }
  }

  const somaItens = r.itens.reduce((s, i) => s + i.valor_total, 0);
  const esperado = somaItens - r.desconto + r.acrescimo;
  if (Math.abs(esperado - r.total) > TOLERANCIA) {
    erros.push(
      `Soma não fecha: itens ${somaItens.toFixed(2)} - desconto ${r.desconto} + acréscimo ${r.acrescimo} = ${esperado.toFixed(2)}, mas o total é ${r.total}`,
    );
  }

  if (r.total < 0) erros.push("Total negativo");
  return erros;
}
