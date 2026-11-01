# Nome do Micro-SaaS

> Uma frase: o que faz, para quem.

## Problema e público

- **Quem sofre o problema:** …
- **Como resolvem hoje e por que é ruim:** …
- **Por que IA (e não regra ou planilha):** … (Módulo 9.1)
- **Como sabemos que é um problema real:** entrevistas, dados, chamados…

## O que o produto faz

1. …
2. …
3. …

O que **não** faz (escopo explícito): …

## Arquitetura

Resumo aqui; detalhes em [ARQUITETURA.md](./ARQUITETURA.md).

| Peça | Tecnologia | Módulo de referência |
|---|---|---|
| Front-end | … | 8 |
| Back-end / API | … | 2, 9 |
| RAG | … | 4 |
| Agente(s) | … | 6 |
| Servidor MCP | … | 5 |
| Gateway, custos, observabilidade | … | 9 |

## Como rodar

```bash
cp .env.example .env    # preencha as chaves
npm install             # ou pip install -r requirements.txt
npm test                # testes sem chave de API
npm run dev
```

## Avaliação (evals) e resultados

| Métrica | Valor | Como foi medida |
|---|---|---|
| Acerto da tarefa principal | …% (IC 95%: …–…) | N casos × R repetições (`evals/`) |
| Recuperação (acerto@5) | … | `avaliacao/perguntas.jsonl` |
| Ataques de red team bem-sucedidos | …/… | Módulo 12 |

## Custos

- Custo por tarefa concluída: US$ …
- Projeção para … usuários/mês: US$ …
- Alavancas aplicadas: modelo por rota, cache, batch…

## Segurança e privacidade

- Dados pessoais tratados e base legal: …
- Defesas contra prompt injection: …
- Ações que exigem aprovação humana: …
- Ficha do sistema: [ficha.md](./ficha.md)

## Decisões e próximos passos

- Decisão 1: escolhemos X em vez de Y porque … (com números)
- Limitações conhecidas: …
- Próximos passos: …
