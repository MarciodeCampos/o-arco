import type { Caso, Checagem, Saida } from "./tipos.js";

const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "") || null;

/**
 * Checagens atômicas: cada propriedade é avaliada separadamente.
 * Um número único ("nota 7") esconde *o que* piorou; checagens separadas mostram.
 */
export function avaliar(caso: Caso, saida: Saida): Checagem[] {
  const e = caso.esperado;
  const r = saida.recibo;
  const checagens: Checagem[] = [];

  // "Sem resposta" nunca pode passar por "resposta negativa".
  if (!r) {
    const esperavaSinalizar = e.deve_sinalizar === true;
    checagens.push({
      nome: "produziu_recibo",
      passou: esperavaSinalizar && saida.problemas.length > 0,
      detalhe: `sem recibo; problemas: ${saida.problemas.join("; ") || "nenhum"}`,
    });
    return checagens;
  }

  if (e.total !== undefined) {
    // Tolerância de 1 centavo: 84.9 e 84.90 são a mesma coisa.
    checagens.push({
      nome: "total",
      passou: Math.abs(r.total - e.total) <= 0.01,
      detalhe: `esperado ${e.total}, obtido ${r.total}`,
    });
  }
  if (e.data !== undefined) {
    checagens.push({ nome: "data", passou: r.data === e.data, detalhe: `esperado ${e.data}, obtido ${r.data}` });
  }
  if (e.cnpj !== undefined) {
    // Normaliza os dois lados: "11.222.333/0001-81" e "11222333000181" são iguais.
    const obtido = soDigitos(r.emitente.cnpj);
    checagens.push({
      nome: "cnpj",
      passou: obtido === soDigitos(e.cnpj),
      detalhe: `esperado ${e.cnpj}, obtido ${r.emitente.cnpj}`,
    });
  }
  if (e.n_itens !== undefined) {
    checagens.push({
      nome: "n_itens",
      passou: r.itens.length === e.n_itens,
      detalhe: `esperado ${e.n_itens}, obtido ${r.itens.length}`,
    });
  }
  if (e.forma_pagamento !== undefined) {
    checagens.push({
      nome: "forma_pagamento",
      passou: r.forma_pagamento === e.forma_pagamento,
      detalhe: `esperado ${e.forma_pagamento}, obtido ${r.forma_pagamento}`,
    });
  }
  if (e.deve_sinalizar !== undefined) {
    // Nos dois sentidos: sinalizar quando deve E aprovar quando deve.
    // Sem o segundo lado, "sinalizar tudo" tiraria nota máxima.
    const sinalizou = r.confianca === "baixa" || saida.problemas.length > 0;
    checagens.push({
      nome: "sinalizacao",
      passou: sinalizou === e.deve_sinalizar,
      detalhe: `deveria ${e.deve_sinalizar ? "" : "não "}sinalizar; confianca=${r.confianca}, problemas=${saida.problemas.length}`,
    });
  }
  return checagens;
}

/** O caso passa só se todas as checagens aplicáveis passarem. */
export const casoPassou = (checagens: Checagem[]) => checagens.length > 0 && checagens.every((c) => c.passou);
