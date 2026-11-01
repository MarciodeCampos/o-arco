import type { Recibo } from "../../../modulo-02/projeto/src/esquema.js";
import type { Uso } from "../../../modulo-02/projeto/src/custo.js";

/** Um caso de avaliação: a entrada e o que esperamos dela. */
export interface Caso {
  id: string;
  tags: string[];
  /** De onde veio o gabarito: "humano", "humano-verificado" ou "modelo:<nome>". */
  origem: string;
  texto: string;
  esperado: Esperado;
  nota?: string;
}

/** Só os campos presentes são verificados. Ausente = "não importa neste caso". */
export interface Esperado {
  total?: number;
  data?: string;
  cnpj?: string | null;
  n_itens?: number;
  forma_pagamento?: Recibo["forma_pagamento"];
  /** true: o sistema deve marcar para revisão. false: deve aprovar. */
  deve_sinalizar?: boolean;
}

/** O que o sistema produziu para um caso (a saída do extrator real). */
export interface Saida {
  recibo: Recibo | null;
  problemas: string[];
}

export interface Checagem {
  nome: string;
  passou: boolean;
  detalhe?: string;
}

/** Uma execução (caso × repetição) que produziu saída avaliável. */
export interface Linha {
  caso: string;
  tags: string[];
  rep: number;
  modelo: string;
  modelosServidos: string[];
  tentativas: number;
  latenciaS: number;
  usos: Uso[];
  custoUsd: number;
  saida: Saida;
  checagens: Checagem[];
  passou: boolean;
  juiz?: { nota: boolean; justificativa: string };
}

/** Uma execução que NÃO produziu saída avaliável (erro de infraestrutura). Nunca vira nota zero. */
export interface ErroInfra {
  caso: string;
  rep: number;
  classe: "rate_limit" | "timeout" | "conexao" | "servidor" | "modelo_trocado" | "outro";
  mensagem: string;
}
