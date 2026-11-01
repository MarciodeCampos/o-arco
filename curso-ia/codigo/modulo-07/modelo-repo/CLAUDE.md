# Serviço de Frete — instruções para agentes de código

Serviço TypeScript que calcula frete e aplica cupons para a loja online. Usado pelo checkout:
um erro aqui cobra o valor errado de clientes reais.

## Comandos

- `npm test` — testes (node:test via tsx). Rode depois de qualquer mudança em `src/`.
- `npm run typecheck` — TypeScript estrito.
- `npm run verificar` — a "definição de pronto": typecheck + testes + checagens de segurança.
  **Uma tarefa só está concluída quando este comando passa.**

## Arquitetura

- `src/frete.ts` — cálculo de frete por faixa de CEP e peso. Funções puras.
- `src/dinheiro.ts` — toda conta com dinheiro passa por aqui (centavos inteiros, nunca `number` com vírgula).
- `specs/` — especificações de funcionalidades. Cada spec tem testes de aceitação.

## Regras do projeto

- Valores em dinheiro são **centavos inteiros** (`number` inteiro). Nunca some reais com ponto flutuante:
  `0.1 + 0.2 !== 0.3`, e isso vira centavo errado na fatura.
- Funções de cálculo são puras: sem I/O, sem data/hora atual (receba a data como parâmetro). Isso as
  mantém testáveis.
- Toda regra nova vem com testes, incluindo os casos de borda descritos na spec.
- Não adicione dependências sem perguntar. O serviço tem zero dependências de produção de propósito.
- Mensagens de erro em português, voltadas a quem opera o checkout.

## Não faça

- Não altere testes existentes para fazê-los passar. Se um teste parece errado, pare e explique.
- Não leia nem edite `.env*` (há um hook que bloqueia).
- Não faça commit nem push sem pedido explícito.
