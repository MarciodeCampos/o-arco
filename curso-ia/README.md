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
└── codigo/
    ├── modulo-01/
    │   ├── python/       labs e projeto (NumPy + SDK anthropic)
    │   ├── typescript/   labs (sem dependências + SDK @anthropic-ai/sdk)
    │   └── dados/        corpus do projeto
    └── modulo-02/
        ├── python/       labs: chat, saída estruturada, ferramentas, cache, batch
        ├── typescript/   labs: chat, saída estruturada, ferramentas, streaming, erros
        ├── dados/        e-mails, manual de produto, avaliações
        └── projeto/      extrator de recibos (TypeScript, com testes)
```

## Status

| Módulo | Status |
|---|---|
| 01 · Fundamentos de IA e LLMs para Devs | ✅ pronto |
| 02 · APIs de LLM e Engenharia de Contexto | ✅ pronto |
| 03 – 15 | planejados (ver `curriculo.json`) |

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
