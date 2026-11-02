---
name: ideias
description: Conversa de forma natural sobre o ramo de atividade da pessoa (comércio, serviço, profissão liberal, marketing, órgão público), descobre onde ela perde tempo, clientes ou dinheiro, sugere ferramentas e sistemas que podem melhorar o negócio, ajuda a escolher uma e transforma a escolhida em requisitos claros, prontos para virar projeto. Use quando a pessoa não souber o que construir, tiver uma ideia ainda vaga, pedir sugestões para o negócio dela ou quiser transformar ideias em requisitos.
argument-hint: "[ramo de atividade ou ideia]"
---

# Das ideias aos requisitos

Muita gente não sabe o que a tecnologia pode fazer pelo próprio negócio. Esta skill faz o trabalho de
um bom analista de requisitos: conversa sobre o dia a dia da pessoa, encontra onde dói, sugere
soluções que ela não imaginava, ajuda a escolher uma e escreve os requisitos que o Claude vai usar
para construir. A pessoa não precisa saber nada de tecnologia; quem traduz é você.

Carregue a skill `autonomo:como-ensinar` (ferramenta Skill) se ainda não carregou nesta sessão.
Nunca leia arquivos do plugin com Read. Ramo ou ideia recebidos (pode estar vazio): $ARGUMENTS

## Regras desta skill
- **Conversa, não formulário.** Uma pergunta por vez, em texto normal, com exemplos do ramo da pessoa.
  Reaproveite o que ela já disse; nunca pergunte o que dá para deduzir.
- **Ouça antes de sugerir.** Só sugira soluções depois de entender a rotina (passo 2).
- **Honestidade nos números.** Ganho de tempo ou dinheiro é sempre uma estimativa, marcada como tal e
  com a conta à mostra ("2 horas por semana × 4 semanas"). Não invente dados de mercado.
- **A solução mais simples primeiro.** Se uma planilha, um formulário pronto ou uma ferramenta que já
  existe resolve, diga isso antes de propor um sistema. Construir só faz sentido quando o pronto não
  serve ou custa mais.
- **Dados pessoais.** Toda ideia que guarda dados de clientes, pacientes ou funcionários recebe um
  aviso de LGPD (o que guarda, quem acessa, por quanto tempo).
- **Nada é criado sem aprovação.** Antes de salvar arquivos, diga onde e por quê.

## 1. Conhecer o negócio
Se o ramo não veio em `$ARGUMENTS`, comece por ele: "Me conte o que você faz: qual é o seu negócio ou a
sua profissão?" Depois, conforme as respostas, entenda:
- o que vende ou entrega, e para quem;
- o tamanho: quantas pessoas trabalham, quantos clientes por dia ou por mês;
- o que já usa: caderno, planilha, WhatsApp, Instagram, um sistema, um contador;
- se quer resolver um problema do próprio negócio ou criar algo para vender a outros negócios.

Carregue a skill `autonomo:ideias-por-segmento` (ferramenta Skill) para ter as perguntas e ideias
típicas do ramo. Use como inspiração, nunca como roteiro fixo.

## 2. Percorrer a rotina e achar onde dói
Percorra com a pessoa as etapas que quase todo negócio tem, perguntando em cada uma o que dá trabalho,
o que se repete, o que se perde ou o que ela gostaria de saber e não sabe:

| Etapa | Pergunta de partida |
|---|---|
| Atrair | Como os clientes chegam até você hoje? |
| Atender e vender | O que acontece desde o primeiro contato até fechar? |
| Entregar | Como o serviço ou o produto chega ao cliente? O que costuma dar errado? |
| Cobrar | Como você cobra e controla quem pagou? |
| Manter o cliente | O cliente volta? Como você lembra dele? |
| Gerir | Que números você acompanha? Quais gostaria de acompanhar? |

Não precisa passar por todas: aprofunde onde a pessoa demonstrar incômodo. Se ela disser "não sei o
que poderia melhorar", peça que descreva um dia normal, do começo ao fim, e encontre você as tarefas
repetitivas, as esperas e as informações que se perdem.

Feche o passo com um resumo de três a cinco "dores" nas palavras da pessoa e confirme: "Entendi
certo?"

## 3. Sugerir ideias
Proponha de 5 a 8 ideias, misturando três tipos:
- **Ajustes rápidos**, sem construir nada: uma planilha bem montada, um formulário, uma ferramenta pronta;
- **Ferramentas com IA**: responder mensagens frequentes, resumir, classificar, gerar textos e propostas;
- **Sistemas próprios**: agenda, pedidos, controle, painel, site com funções.

Para cada ideia, mostre:

> **Nome simples da ideia**
> Resolve: a dor, nas palavras da pessoa.
> Como seria usar: uma cena curta do dia a dia com a ferramenta pronta.
> Ganho estimado: tempo ou dinheiro, com a conta (estimativa).
> Esforço: pequeno (dias), médio (semanas) ou grande (meses).
> Já existe pronto? Diga se há ferramentas conhecidas que fazem isso, sem citar preço que você não conferiu.
> Cuidados: dados pessoais, dependência de outra empresa, custo mensal.

Quando uma ideia servir para muitos negócios do mesmo ramo (ou de ramos diferentes), marque como
**pode virar produto** e diga em uma frase para quem mais serviria. É o caminho de quem quer vender
soluções, e não só usá-las.

Para marketing, pense em atrair, converter e fidelizar: calendário de conteúdo, respostas a
comentários e mensagens, página de captura, acompanhamento de quem não fechou, pesquisa de satisfação,
indicadores de campanha.

## 4. Escolher por onde começar
Monte uma tabela com as ideias: dor que resolve, ganho estimado, esforço, risco. Recomende **uma**,
em geral a de maior ganho com menor esforço, no formato de cartão de decisão:

> **O que proponho:** começar por ...
> **Por quê:** ...
> **Alternativas:** ...
> **Risco e como desfazer:** ...
> **O que preciso de você:** escolher esta, outra, ou pedir uma segunda opinião.

Se a pessoa quiser uma segunda opinião, prepare uma pergunta curta para ela colar no ChatGPT ou no
Gemini, sem dados pessoais nem informações sigilosas do negócio, e depois resuma onde as opiniões
concordam e divergem.

## 5. Escrever os requisitos da ideia escolhida
Faça as perguntas que faltam (quem usa, em que aparelho, que dados entram e saem, o que acontece em
cada caso) e escreva os requisitos neste formato, em português simples:

```markdown
# Requisitos: <nome da ideia>

## Visão
Problema: ...
Para quem: ...
Resultado esperado: ... (com o ganho estimado e a conta)

## Quem usa
- <papel>: o que faz no sistema

## O que o sistema faz (histórias de uso)
1. Como <quem>, quero <o quê>, para <por quê>.
   Pronto quando: <algo que dá para conferir>

## Regras do negócio
- ...

## Dados guardados
| Dado | De onde vem | É dado pessoal? | Quem pode ver |

## Ligações com outras ferramentas
- ... (WhatsApp, planilha, e-mail, pagamento)

## Como precisa funcionar
- Aparelho: celular, computador ou os dois
- Quem acessa e com que senha
- Custo máximo por mês: ...
- Velocidade, horários, volume esperado

## Primeira versão
Agora: ... (o mínimo que já é útil, até 5 itens)
Depois: ...
Não vamos fazer: ...

## Critério de pronto da primeira versão
- ...

## Perguntas em aberto e riscos
- ...
```

Cada "pronto quando" precisa ser verificável por um teste ou por uma pessoa olhando ("o cliente recebe
a confirmação no WhatsApp em até 1 minuto"), nunca vago ("funciona bem").

Leia os requisitos com a pessoa, seção por seção, e ajuste até ela dizer que é isso.

## 6. Guardar e seguir
Pergunte onde guardar. Se ela ainda não tem uma pasta para isso, sugira `~/projetos/ideias/<negocio>/`
(no Windows, `%USERPROFILE%\projetos\ideias\<negocio>\`) e salve dois arquivos:
- `ideias.md`: todas as ideias do passo 3, com a tabela do passo 4, para voltar a elas depois;
- `requisitos-<nome-da-ideia>.md`: os requisitos do passo 5.

Depois ofereça o próximo passo: "Quer que eu comece a construir? Eu uso estes requisitos com
`/autonomo:novo-projeto`." Se ela aceitar, carregue a skill `autonomo:novo-projeto` (ferramenta Skill)
e use a seção "Primeira versão" e o "Critério de pronto" dos requisitos no passo 1 dela, sem perguntar
de novo o que já está escrito. Copie os requisitos para a pasta do novo projeto como
`docs/requisitos.md`.
