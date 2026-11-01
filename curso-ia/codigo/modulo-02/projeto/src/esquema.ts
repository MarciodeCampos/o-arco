import { z } from "zod";

/** Um item da nota. Valores em reais, como número (ex.: 12.49). */
export const Item = z.object({
  descricao: z.string(),
  quantidade: z.number(),
  valor_unitario: z.number(),
  valor_total: z.number(),
});

/** O contrato entre o LLM e o resto do sistema. */
export const Recibo = z.object({
  emitente: z.object({
    nome: z.string(),
    cnpj: z.string().nullable().describe("Só os 14 dígitos, sem pontuação. null se não aparecer"),
  }),
  data: z.string().describe("Formato AAAA-MM-DD"),
  itens: z.array(Item),
  desconto: z.number().describe("0 se não houver"),
  acrescimo: z.number().describe("Taxa de serviço, frete etc. 0 se não houver"),
  total: z.number(),
  forma_pagamento: z.enum(["dinheiro", "pix", "debito", "credito", "outro", "nao_informado"]),
  confianca: z
    .enum(["alta", "media", "baixa"])
    .describe("baixa se o texto tiver erros de OCR ou campos ilegíveis"),
  observacoes: z.string().describe("Problemas encontrados na leitura. Vazio se nenhum"),
});

export type Recibo = z.infer<typeof Recibo>;
