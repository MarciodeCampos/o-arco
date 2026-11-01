---
name: central
description: Monta uma central para acompanhar e alterar todos os projetos da pessoa a partir de uma pasta só, usando o projetos.json - painel com o estado de cada projeto, rotina para trabalhar em qualquer um deles e preparo (GitHub, CLAUDE.md, testes, publicação automática) de um projeto por vez. Use quando a pessoa quiser cuidar de vários projetos pelo mesmo terminal, perguntar como estão os projetos, pedir para mexer num projeto pelo nome, ou quiser que os projetos trabalhem de forma quase autônoma.
---

# Central de projetos

Carregue, com a ferramenta Skill, `autonomo:como-ensinar` (se ainda não carregou nesta sessão) e
`autonomo:niveis`. Nunca leia arquivos do plugin com Read.

Explique em duas frases: a central é uma pasta com o mapa de todos os projetos (`projetos.json`) e
um `CLAUDE.md` que ensina o Claude onde cada projeto está e como trabalhar nele. Dela a pessoa pede
"atualize o projeto X" pelo nome, sem precisar lembrar pastas nem comandos.

## 1. Encontrar ou criar a central
- A central é a pasta onde está o `projetos.json`. Se não existir, rode antes a skill
  `autonomo:mapear-projetos` e volte aqui.
- Se a pasta ainda não tem git, crie (`git init`) e confira que o `.gitignore` tem `.env`, `.env.*`
  e as pastas de exportação ou dados pessoais (por exemplo `export-claude/`). O `projetos.json` é
  interno: o repositório da central deve ser **privado**.

## 2. Escrever o painel no CLAUDE.md da central
Acrescente (sem apagar o que já existe) uma seção `## Central de projetos` com:

1. **Tabela gerada do `projetos.json`**, só com os itens do tipo plataforma, produto, módulo ou
   ferramenta que têm pasta ou repositório: nome, `id`, pasta local, repositório, endereço, e uma
   coluna **Preparo** com cinco marcas: git · GitHub · CLAUDE.md · testes · publicação automática
   (✓ feito, ✗ falta, ? não verificado).
2. **A rotina abaixo, copiada como está**, para que qualquer sessão futura nesta pasta a siga:

```
Para trabalhar num projeto pelo nome:
1. Ache o item no projetos.json (pelo nome, id ou apelido). Se houver dúvida, pergunte qual.
2. Se a pasta dele não estiver acessível, peça para a pessoa digitar /add-dir <pasta>.
   Para trabalho longo, sugira abrir um terminal na pasta do projeto (cd <pasta> e depois claude),
   porque lá valem o CLAUDE.md e as proteções do próprio projeto.
3. Leia o CLAUDE.md do projeto antes de mudar qualquer coisa. Se não existir, ofereça o preparo.
4. Trabalhe numa branch nova, rode os testes do projeto, abra pull request.
5. Um projeto por vez: nunca misture mudanças de dois repositórios no mesmo commit.
6. Ao terminar, atualize no projetos.json da central o ultima_alteracao e o proximo_passo do item.
7. Produção, custos, dados de clientes e apagar coisas: só com o ok da pessoa.
```

Mostre a tabela à pessoa e diga quais projetos estão prontos para trabalho autônomo (cinco ✓) e
quais precisam de preparo.

## 3. Ver como estão os projetos
Quando a pessoa perguntar "como estão meus projetos", sem alterar nada:
- Para cada projeto com pasta, rode um comando por vez: `git -C <pasta> status --short`,
  `git -C <pasta> log -1 --format=%cs` e, se tiver repositório, `gh pr list --repo <dono/repo>`.
- Se tiver endereço, confira se responde (`curl -sI <url>`).
- Entregue uma tabela curta: projeto, mudanças não salvas, último commit, PRs abertos, no ar ou não,
  próximo passo. Destaque o que pede ação dela.

## 4. Preparar um projeto (um por vez, com aprovação)
Sugira começar pelos projetos **publicados que ainda não têm repositório no GitHub**: são os que mais
correm risco de perder trabalho. Para o projeto escolhido, mostre o plano e peça ok antes de começar:

1. **Git**: se não tem, `git init` na pasta e primeiro commit. Antes, crie o `.gitignore` com `.env`,
   `.env.*`, `node_modules/`, `.venv/`, chaves (`*.pem`) e **pastas de dados grandes ou com dados
   pessoais** (CSV de clientes, bases da Receita Federal, backups). Rode `git status` e mostre à
   pessoa a lista do que vai entrar antes do commit. Se aparecer algo suspeito, pare e pergunte.
2. **GitHub privado**: `gh repo create <nome> --private --source . --push`. Criar repositório é
   visível fora do computador: confirme o nome com a pessoa antes.
3. **CLAUDE.md do projeto**: o que é, como rodar, como testar, como publicar, onde estão os
   segredos (só os nomes das variáveis, nunca os valores) e o que pede aprovação.
4. **Testes mínimos**: pelo menos um teste que abre a página ou chama a função principal e confere
   que funciona. Mais testes vêm com o tempo.
5. **Proteções**: `.claude/settings.json` do projeto com o modelo `projeto-settings.json` da skill
   `autonomo:modelos`, e proteção da branch `main` no GitHub (como na skill `autonomo:novo-projeto`).
6. **Publicação automática** (só se o projeto já está publicado e a pessoa quiser): um workflow do
   GitHub Actions que roda os testes e publica a cada merge na `main`. O token da plataforma vai nos
   segredos do GitHub (siga a seção "Segredos" da skill `autonomo:implantar`). Para o merge
   automático com testes verdes: ative "Allow auto-merge" no repositório e use `gh pr merge --auto`.

Depois de cada projeto, atualize a coluna Preparo do painel, o `repositorio` no `projetos.json`, e
pergunte se segue para o próximo.

## 5. Trabalhar de qualquer lugar
Explique numa frase: projeto com repositório no GitHub também pode ser alterado pelo app do Claude
(aba Code), inclusive no celular, sem o computador ligado. Projeto só no computador depende dele.

## Regras
- Fora do projeto em que está trabalhando, só leitura.
- Nunca abra `.env`, chaves ou credenciais de nenhum projeto.
- Comandos git, um por vez. Comandos que a pessoa vai digitar: um por linha, sem `&&` (o PowerShell
  do Windows recusa).
- Produção, cobrança, dados de clientes, apagar arquivos e reescrever histórico: só com o ok da pessoa.
