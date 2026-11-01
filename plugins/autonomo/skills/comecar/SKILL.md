---
name: comecar
description: Conduz uma pessoa que nunca usou IA ou terminal do zero até um ambiente pronto, com o Claude trabalhando com autonomia e barreiras de segurança, e um primeiro projeto rodando. Use quando a pessoa disser que está começando, pedir para configurar o computador, preparar o ambiente, ou "deixar o Claude autônomo".
---

# Começar: do zero ao primeiro projeto

Você vai conduzir a pessoa por cinco etapas. Antes de tudo, carregue a skill `autonomo:como-ensinar`
(ferramenta Skill) e siga essas regras do começo ao fim.

**Arquivos do plugin:** nunca leia arquivos do plugin com a ferramenta Read nem com comandos; eles ficam fora da pasta do projeto e isso faria aparecer, em inglês, uma pergunta de permissão que assusta quem está começando. Tudo de que você precisa chega pela ferramenta Skill.
Crie uma lista de tarefas (TaskCreate) com as cinco etapas para a pessoa acompanhar o progresso.

## Etapa 1 · Boas-vindas e objetivo (2 minutos)

Explique em até quatro frases:
- Você é o Claude e vai preparar o computador dela para trabalhar junto.
- Ela vai aprovar as decisões importantes; você faz o trabalho técnico.
- Nada será instalado ou alterado sem você avisar antes.
- No fim, ela terá um projeto funcionando e um ambiente em que você pode trabalhar sozinho com segurança.

Pergunte (AskUserQuestion) o que ela quer fazer primeiro, com opções como: **organizar e evoluir
projetos que já tenho**; um site ou página pessoal; um aplicativo web; automatizar uma tarefa
repetitiva (planilhas, arquivos, e-mails); ainda não sei, quero aprender. Pergunte também, em outra questão, quanta experiência ela tem: nunca
programei; já programei um pouco; sou desenvolvedor. Guarde as respostas: elas definem o
{{PERFIL}} do CLAUDE.md e o projeto da etapa 5.

## Etapa 2 · Diagnóstico

Carregue e siga a skill `autonomo:diagnostico` (ferramenta Skill). Mostre a tabela e
diga o que falta para o objetivo dela.

## Etapa 3 · Instalar o que falta

Para cada item necessário que falta, um por vez:
1. Diga o que é, para que serve e o tamanho aproximado do esforço.
2. Instale com o método oficial do sistema dela, depois de avisar:
   - macOS: Homebrew (`brew install git node gh`); se não houver Homebrew, ofereça instalá-lo pelo
     comando oficial de https://brew.sh, ou baixar os instaladores dos links da
     skill `autonomo:links`.
   - Ubuntu/Debian/WSL: `sudo apt-get update && sudo apt-get install -y git bubblewrap socat` e o Node.js
     LTS pelo método recomendado em https://nodejs.org/pt/download. O `sudo` pede a senha do
     computador: avise que ela digita a senha no terminal, que os caracteres não aparecem, e que você
     nunca vê essa senha.
   - Windows: `winget install --id Git.Git -e`, `winget install OpenJS.NodeJS.LTS`, `winget install GitHub.cli`.
3. Confira com `--version` e mostre o resultado.

Configure a identidade do git se faltar: pergunte o nome e o e-mail que ela quer que apareçam no
histórico (pode ser o e-mail do GitHub) e rode `git config --global user.name` e `user.email`.
Faça essa pergunta em texto normal, não com AskUserQuestion: nome e e-mail são texto livre, e o menu
de opções obriga a pessoa a achar "Other", o que confunde. Escreva, por exemplo: "Digite abaixo o
nome e o e-mail que vão aparecer no histórico, assim: Meu nome é Ana Souza, e-mail ana@exemplo.com".
Se você já sabe um e-mail provável, sugira-o na frase.

**GitHub:** se ela não tem conta, mande o link https://github.com/signup e espere. Depois, o login
com `gh auth login --web`, seguindo a seção "Logins pelo navegador" da skill `autonomo:como-ensinar`.
Confira com `gh auth status`.

## Etapa 4 · Autonomia com barreiras

Carregue e siga a skill `autonomo:configurar-autonomia` (ferramenta Skill) do começo ao fim, incluindo a prova das barreiras. Não pule a prova: é o que mostra à pessoa que a
autonomia é segura.

## Etapa 5 · Primeiro projeto

Se na etapa 1 ela disse que já tem projetos, comece pela skill `autonomo:mapear-projetos`
(ferramenta Skill): ela encontra os projetos no computador e no GitHub e gera o `projetos.json`.
Depois, pergunte o que ela quer fazer com eles (por exemplo, uma página que mostra o mapa, ou
colocar testes e proteção de segredos num deles) e siga a skill adequada.

Caso contrário, carregue e siga a skill `autonomo:novo-projeto` (ferramenta Skill) com o objetivo
escolhido na etapa 1. Para quem nunca programou, escolha algo que dá para ver funcionando no
navegador em poucos minutos.

## Encerramento

Faça um resumo com:
- o que foi instalado e configurado, e onde ficaram os backups;
- o nível de autonomia e o que ele permite e bloqueia, em três linhas;
- onde está o projeto e como abri-lo de novo: `cd pasta` e depois `claude`, em duas linhas (o
  PowerShell do Windows não aceita `&&`);
- três próximos pedidos que ela pode fazer, escritos como ela diria, por exemplo:
  "Adicione uma página de contato ao meu site e publique".

Ofereça, numa frase, a skill `autonomo:skills-recomendadas`: uma seleção de plugins oficiais que
ampliam o que você sabe fazer para o tipo de projeto dela.

Lembre que, a partir de agora, o `~/.claude/CLAUDE.md` faz você trabalhar assim em toda sessão, e
que `/autonomo:diagnostico` confere o ambiente a qualquer momento.
