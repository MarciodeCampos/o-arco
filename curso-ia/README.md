# Engenharia de IA Aplicada

Curso de Engenharia de IA Aplicada, publicado em `triadic.life/curso-ia/`.

Currículo revisado a partir de uma ementa de pós-graduação de mercado. As mudanças:

- novo módulo de **Evals** (avaliação de sistemas com LLM), logo depois das APIs;
- **segurança** com conteúdo técnico (OWASP para LLMs, prompt injection, red teaming), além da governança;
- cada tema (RAG, MCP, agentes) aparece em **um só módulo**, com mais profundidade;
- **TypeScript** para web, APIs e agentes; **Python** para fine-tuning, LoRA e ML;
- conteúdo neutro em fornecedor, com agentes de código atuais;
- correção da unidade copiada por engano no módulo de fine-tuning da ementa original.

## Estrutura

```
curso-ia/
├── index.html            capa + currículo (lido de curriculo.json)
├── curriculo.json        fonte única do currículo: módulos, unidades, horas, status
├── assets/
│   ├── curso.css         estilos (paleta do portal triadic.life)
│   └── curso.js          currículo, quiz, copiar código, progresso local
├── modulo-01/index.html  aulas do módulo 1
├── modulo-02/index.html  aulas do módulo 2
├── modulo-03/index.html  aulas do módulo 3
├── modulo-04/index.html  aulas do módulo 4
├── modulo-05/index.html  aulas do módulo 5
├── modulo-06/index.html  aulas do módulo 6
├── modulo-07/index.html  aulas do módulo 7
├── modulo-08/index.html  aulas do módulo 8
├── modulo-09/index.html  aulas do módulo 9
└── codigo/
    ├── modulo-01/
    │   ├── python/       labs e projeto (NumPy + SDK anthropic)
    │   ├── typescript/   labs (sem dependências + SDK @anthropic-ai/sdk)
    │   └── dados/        corpus do projeto
    ├── modulo-02/
    │   ├── python/       labs: chat, saída estruturada, ferramentas, cache, batch
    │   ├── typescript/   labs: chat, saída estruturada, ferramentas, streaming, erros
    │   ├── dados/        e-mails, manual de produto, avaliações
    │   └── projeto/      extrator de recibos (TypeScript, com testes)
    ├── modulo-03/
    │   ├── python/       labs: auditoria de dataset, avaliadores, LLM-juiz, ruído estatístico
    │   ├── dados/        dataset com problemas plantados, resumos rotulados por humanos
    │   └── projeto/      suíte de evals do extrator (TypeScript, com testes e exemplo de CI)
    ├── modulo-04/
    │   ├── python/       labs: BM25 do zero, vetores e escala
    │   └── projeto/      RAG com PGlite + pgvector, busca híbrida, citações e evals
    ├── modulo-05/
    │   ├── python/       servidor e cliente MCP, testes, servidor envenenado e verificador
    │   └── projeto/      o RAG do módulo 4 como servidor MCP (stdio e HTTP), com proteções
    ├── modulo-06/
    │   ├── python/       labs: padrões de workflow, tool runner, custo de agentes
    │   └── projeto/      agente do zero, supervisor multiagente, memória e evals de trajetória
    ├── modulo-07/
    │   ├── python/       verificador de código gerado, revisor de diff com LLM
    │   ├── modelo-repo/  repositório pronto para agentes (CLAUDE.md, hooks, skill, subagente, spec)
    │   └── solucao-referencia/  implementação de referência da spec de cupons
    ├── modulo-08/
    │   ├── python/       labs: visão (foto de cupom) e PDF com citações
    │   ├── dados/        foto de cupom e contrato em PDF de exemplo
    │   └── projeto/      app multimodal: chat com streaming, análise de imagem, testes E2E
    └── modulo-09/
        ├── python/       lab: planejamento de capacidade e custo
        └── projeto/      gateway de LLM: roteamento, reserva, cache, cotas, prompts versionados, painel
```

## Status

| Módulo | Status |
|---|---|
| 01 · Fundamentos de IA e LLMs para Devs | ✅ pronto |
| 02 · APIs de LLM e Engenharia de Contexto | ✅ pronto |
| 03 · Avaliação (Evals) e Testes | ✅ pronto |
| 04 · RAG de Ponta a Ponta | ✅ pronto |
| 05 · MCP — Model Context Protocol | ✅ pronto |
| 06 · Agentes de IA | ✅ pronto |
| 07 · Agentes de Código | ✅ pronto |
| 08 · IA no Front-end, UX e Multimodal | ✅ pronto |
| 09 · Arquitetura e LLMOps | ✅ pronto |
| 10 – 15 | planejados (ver `curriculo.json`) |

## Rodando os labs do Módulo 1

```bash
cd curso-ia/codigo/modulo-01
pip install -r python/requirements.txt
python python/01_rede_neural_xor.py
python python/02_atencao.py
python python/03_amostragem.py
python python/projeto_modelo_de_linguagem.py

# precisa de ANTHROPIC_API_KEY
python python/04_primeira_chamada.py

cd typescript && npm install
npx tsx 01-rede-neural-xor.ts
npx tsx 04-primeira-chamada.ts
```

## Rodando os labs do Módulo 2

```bash
cd curso-ia/codigo/modulo-02
pip install -r python/requirements.txt
python python/02_saida_estruturada.py      # todos os labs do módulo 2 precisam de ANTHROPIC_API_KEY

cd projeto && npm install
npm test                                   # 14 testes, sem chamar a API
npm run extrair
```

## Rodando o Módulo 3

```bash
cd curso-ia/codigo/modulo-03
python python/01_auditar_dataset.py        # 01, 02 e 04 rodam sem API
python python/04_ruido_estatistico.py

cd projeto && npm install                  # instala também o projeto do módulo 2
npm test                                   # 14 testes, sem chamar a API
npm run eval -- --reps 3                   # precisa de ANTHROPIC_API_KEY
```

## Rodando o Módulo 4

```bash
cd curso-ia/codigo/modulo-04
python python/01_bm25_do_zero.py           # labs sem API

cd projeto && npm install
npm test                                   # 16 testes, offline (Postgres em memória)
npm run indexar                            # embedder local; use --embedder hash para offline
npm run avaliar:busca                      # sem API
npm run perguntar -- "Posso usar o purificador na varanda?"   # precisa de ANTHROPIC_API_KEY
```

## Rodando o Módulo 5

```bash
cd curso-ia/codigo/modulo-05/python
pip install -r requirements.txt
python cliente_loja.py                     # sem API
python verificar_servidor.py servidor_envenenado.py

cd ../projeto && npm install               # instala também o projeto do módulo 4
npm test                                   # 19 testes, offline
npm run servidor:stdio                     # precisa do índice do módulo 4 (npm run indexar lá)
```

## Como adicionar um módulo

1. Copie `modulo-01/index.html` para `modulo-NN/index.html` e troque o conteúdo. Cada aula é uma
   `<section class="lesson" id="aula-N">`. O atributo `data-modulo` da `<main>` deve ser `modulo-NN`.
2. Coloque o código em `codigo/modulo-NN/` e **rode tudo antes de publicar**: as saídas mostradas
   nas aulas devem ser as reais.
3. Em `curriculo.json`, mude o `status` do módulo para `"pronto"`. A capa passa a mostrar o link.
4. Quiz: em cada `.q`, marque a alternativa certa com `data-certa`; o `.why` aparece depois da resposta.

## Para transformar em produto

Cada módulo já tem objetivos, carga horária, labs, quiz, projeto com entregáveis e critérios de
avaliação. Falta, para vender:

- vídeos ou aulas ao vivo por aula;
- login e progresso no servidor, em vez do `localStorage`;
- correção de projetos (por pessoas ou por um avaliador automático com rubrica);
- certificado, termos de uso e revisão periódica de preços e modelos citados.

Preços e nomes de modelos citados nas aulas foram conferidos em nov/2026 e precisam ser revisados a cada versão.
