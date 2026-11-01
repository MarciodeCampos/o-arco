# Arquitetura — modelo

## Visão geral

```
[Navegador] ──HTTPS──▶ [Back-end / API] ──▶ [Gateway de LLM] ──▶ [Provedor(es) de modelo]
                            │                    │
                            ├──▶ [RAG: Postgres + pgvector]
                            ├──▶ [Agente] ──MCP──▶ [Servidores MCP internos]
                            └──▶ [Fila / jobs em lote]
        Observabilidade: logs estruturados, traces, custo por cliente e por rota
```

Substitua pelo desenho do seu sistema. Um diagrama simples e correto vale mais que um bonito e vago.

## Fluxos principais

### Fluxo 1: …
1. O usuário …
2. O back-end valida … e chama …
3. …

## Decisões de arquitetura

| Decisão | Alternativas consideradas | Por quê | Evidência |
|---|---|---|---|
| Modelo da tarefa X | … | … | eval: …% vs …%, custo … |
| RAG vs contexto completo | … | … | … |
| Agente vs workflow | … | … | … |

## Limites e proteções

- Orçamento por usuário / por tarefa: …
- Limites de taxa: …
- Aprovação humana em: …
- Dados que nunca vão para o modelo: …

## Falhas e degradação

- Se o provedor cair: …
- Se o RAG não encontrar: …
- Se o custo do dia estourar: …
