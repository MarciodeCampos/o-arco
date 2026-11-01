# Spec: cupons de desconto

**Status:** a implementar · **Testes de aceitação:** `specs/cupons.aceitacao.test.ts`

## Objetivo

O checkout precisa aplicar cupons de desconto ao subtotal do pedido e, em alguns casos, ao frete.

## Interface

Criar `src/cupons.ts` exportando:

```ts
export interface Cupom {
  codigo: string;
  tipo: "percentual" | "valor_fixo" | "frete_gratis";
  valor: number;            // % para "percentual"; centavos para "valor_fixo"; ignorado em "frete_gratis"
  minimoPedido?: Centavos;  // subtotal mínimo para valer
  validoAte?: string;       // data AAAA-MM-DD, inclusive
}

export function aplicarCupom(
  cupom: Cupom,
  pedido: { subtotal: Centavos; frete: Centavos },
  hoje: string,             // AAAA-MM-DD, recebido como parâmetro (função pura)
): { desconto: Centavos; frete: Centavos; total: Centavos };
```

## Regras

1. **Percentual:** desconto = percentual do subtotal, arredondado ao centavo (use `percentual` de `src/dinheiro.ts`). Não incide sobre o frete.
2. **Valor fixo:** desconto = valor do cupom, **limitado ao subtotal** (o total de produtos nunca fica negativo).
3. **Frete grátis:** desconto 0 sobre o subtotal; o frete passa a ser 0.
4. **Mínimo do pedido:** se `subtotal < minimoPedido`, o cupom é recusado com o erro `Cupom X exige pedido mínimo de R$ Y` (valor formatado com `formatar`).
5. **Validade:** se `hoje > validoAte`, o cupom é recusado com o erro `Cupom X expirou em AAAA-MM-DD`. No próprio dia `validoAte`, ainda vale.
6. **Código** é comparado sem diferenciar maiúsculas e sem espaços nas pontas (não precisa ser tratado nesta função; só ecoe `cupom.codigo` nas mensagens).
7. `total = subtotal - desconto + frete`.

## Fora do escopo

- Combinar mais de um cupom.
- Persistir uso de cupom (limite de usos por cliente).
