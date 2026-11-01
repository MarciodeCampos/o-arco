---
name: nova-regra-de-frete
description: Adicionar ou alterar uma regra de cálculo de frete ou de cupom no serviço de frete. Use quando a tarefa mencionar faixa de CEP, peso, prazo, valor de frete ou cupom.
---

# Como mudar uma regra de frete ou cupom

1. **Leia a spec** em `specs/` (crie uma se não existir, a partir de `specs/cupons.md` como modelo) e
   confirme com o humano os casos de borda antes de codar.
2. **Escreva os testes primeiro**, cobrindo: caso comum, limites (exatamente no mínimo, no último dia
   de validade), entradas inválidas e arredondamento.
3. **Implemente em funções puras** em `src/`. Dinheiro em centavos inteiros (`src/dinheiro.ts`).
   Datas recebidas como parâmetro, nunca `new Date()` dentro do cálculo.
4. Rode `npm run verificar` e só considere pronto quando passar.
5. No resumo final, liste os casos de borda cobertos e qualquer ambiguidade que você resolveu por
   conta própria, para o humano revisar.
