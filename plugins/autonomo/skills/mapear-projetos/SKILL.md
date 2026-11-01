---
name: mapear-projetos
description: Procura os projetos que a pessoa já tem no computador e no GitHub (pastas com git, sites, aplicativos, scripts), descobre onde cada um está publicado e como eles se conectam, e gera um inventário (projetos.json) com um resumo em linguagem simples. Use quando a pessoa disser que já tem projetos, quiser organizar ou listar o que está em desenvolvimento, ou ver como seus sistemas se ligam.
argument-hint: "[pastas onde procurar]"
---

# Mapear os projetos que já existem

Quem já tem projetos quer ir direto à parte útil. Esta skill encontra o que existe, sem alterar nada,
e transforma em um inventário que serve de base para tudo o que vem depois (organizar, conectar,
publicar, criar uma página que mostra os projetos).

Carregue a skill `autonomo:como-ensinar` (ferramenta Skill) se ainda não carregou nesta sessão.
Nunca leia arquivos do plugin com Read. Pastas indicadas pela pessoa (pode estar vazio): $ARGUMENTS

## Regras desta skill
- **Somente leitura.** Não altere, mova, apague, faça commit ou push em nenhum projeto encontrado.
- **Segredos:** nunca abra `.env`, `.env.*`, chaves, `credentials*`, `*.pem`, `id_rsa*` nem pastas
  como `.ssh` e `.aws`. Para saber se um projeto usa um serviço, olhe nomes de dependências e arquivos
  de configuração sem segredos (`package.json`, `vercel.json`, `netlify.toml`, `CNAME`,
  `.github/workflows/*`, `README*`, `.env.example`).
- Ignore `node_modules`, `.venv`, `venv`, `dist`, `build`, `.next`, `.cache`, `vendor`, `AppData`,
  `Library`, `.git` (por dentro) e lixeiras.

## 1. Combinar onde procurar
Pergunte em texto normal (não com AskUserQuestion) em quais pastas os projetos costumam ficar, e
sugira os lugares comuns: `Documentos`, `Desktop`/`Área de Trabalho`, `projetos`, `source/repos`,
`GitHub`, `dev`, `code`. Diga que também vai olhar a conta do GitHub, que costuma ter tudo.

As pastas indicadas ficam fora da pasta desta sessão. Para não aparecer uma pergunta em inglês a
cada arquivo, peça para a pessoa liberar cada pasta uma vez, digitando aqui no Claude:

```
/add-dir C:\Users\NOME\Documents
```
(no Mac ou Linux, por exemplo `/add-dir ~/Documents`). Explique: "isso me deixa ler essa pasta nesta
sessão; não muda nada nela". Se aparecer uma confirmação em inglês, traduza e diga qual opção
escolher, como manda a skill `autonomo:como-ensinar`.

Ofereça também: "Se outro assistente (ChatGPT, Gemini, Antigravity) já conhece seus projetos, cole
aqui a lista dele." Use essa lista como ponto de partida, marcando cada item como **registrado** (veio
da lista) até encontrar a pasta, o repositório ou o endereço que o confirma (**verificado**). Muitos
projetos não são software (obras, catálogos, imóveis, métodos): registre-os também, sem pasta se for o
caso.

## 2. Pistas rápidas: onde a pessoa já trabalhou
Antes de varrer pastas, use os registros que as ferramentas de IA e os editores já guardam. Eles
apontam direto para as pastas de trabalho, inclusive fora das pastas comuns (`C:\`, `D:\`, Google
Drive). Leia **só** os itens abaixo, nunca outros arquivos dessas pastas (algumas guardam logins):
- **Claude Code:** os **nomes** das pastas em `~/.claude/projects/` (cada nome é o caminho de uma
  pasta aberta no Claude, com `\`, `/` e `:` trocados por `-`). Não abra o conteúdo: são conversas.
  Como a troca perde informação, confira se o caminho reconstruído existe.
- **VS Code, Cursor, Windsurf, Antigravity:** a linha `folder` dos arquivos `workspace.json` em
  `%APPDATA%\<Editor>\User\workspaceStorage\*\` (Windows), `~/Library/Application Support/<Editor>/User/workspaceStorage/*/`
  (macOS) ou `~/.config/<Editor>/User/workspaceStorage/*/` (Linux). `<Editor>` é `Code`, `Cursor`,
  `Windsurf` ou `Antigravity`.
- **Antigravity:** as pastas em `~/.gemini/antigravity/` e em `~/.gemini/antigravity/playground/`.
  Muitos projetos moram ali dentro: trate cada subpasta que tenha marcador de projeto (passo 3) como
  um projeto comum e leia o README e a configuração dela. Não abra os arquivos soltos de
  `~/.gemini` (logins como `oauth_creds.json`, `settings.json`, `google_accounts.json`) nem pastas de
  sistema da ferramenta.
- **Codex:** os nomes das pastas em `~/Documents/Codex/`.
Diga à pessoa de onde veio cada pista ("o VS Code lembra que você abriu esta pasta").

## 3. Procurar no computador
Junte às pistas as pastas que a pessoa indicou e os lugares comuns (pasta pessoal, `Documentos`,
`Desktop`, `Downloads`, `projetos`; no Windows, também a raiz de cada disco, como `C:\` e `D:\`, e o
Google Drive, como `G:\Meu Drive`). Libere cada uma com `/add-dir` (passo 1) e procure até 3 níveis de
profundidade. Na raiz de um disco, pule `Windows`, `Program Files*`, `ProgramData`, `$Recycle.Bin` e
`Users` (a pasta pessoal já foi vista).

Um projeto é uma pasta com `.git`, ou, sem git, com `package.json`, `pyproject.toml`,
`requirements.txt`, `index.html` na raiz, `composer.json`, `Gemfile`, `go.mod`, `Cargo.toml`, `pom.xml`,
ou com instruções para agentes de IA: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules`. Pastas de
dados, mídia ou documentos sem código (por exemplo bases de CSV, datasets, catálogos de música) também
contam se a pessoa disser que são projetos: registre-as com a situação e uma descrição. Não entre num projeto já encontrado procurando
outros dentro dele (exceto se ele for claramente uma pasta que agrupa vários).

Use a ferramenta Glob (por exemplo `**/.git/HEAD` e `**/package.json`) ou um comando de busca. No
Windows, os comandos rodam no Git Bash: caminhos como `/c/Users/NOME/Documents` funcionam.

Para cada projeto, colete sem alterar nada (rode cada comando git sozinho):
- nome da pasta e caminho;
- `git -C <pasta> remote get-url origin` (repositório no GitHub ou em outro lugar);
- `git -C <pasta> log -1 --format=%cs` (data da última alteração) e a branch atual;
- `git -C <pasta> status --porcelain` só para saber se há mudanças não salvas (conte as linhas);
- tecnologias, pelos arquivos de configuração e dependências principais;
- onde está publicado: arquivo `CNAME` (domínio do GitHub Pages), `vercel.json`, `netlify.toml`,
  `fly.toml`, `render.yaml`, workflows de deploy, e endereços citados no `README`;
- uma descrição de uma linha, pelo `README` ou pelo `description` do `package.json`.

## 4. Procurar no GitHub
Se o comando `gh` não for encontrado logo depois de instalado (no Windows, o terminal aberto antes
da instalação não o enxerga), use o caminho completo `"/c/Program Files/GitHub CLI/gh.exe"` ou peça
para a pessoa reabrir o terminal. Se o `gh` estiver logado (`gh auth status`), liste os repositórios da pessoa e das organizações dela:

```
gh repo list --limit 300 --json name,nameWithOwner,description,url,homepageUrl,isPrivate,isArchived,pushedAt
```

Repita com `gh repo list <organização>` para cada organização de `gh api user/orgs --jq '.[].login'`.
O `homepageUrl` costuma ser o endereço publicado. Junte com o que achou no computador pelo endereço
do repositório: o mesmo projeto aparece uma vez só, marcando se existe no computador, no GitHub ou
nos dois.

## 5. Descobrir as conexões
Proponha ligações entre projetos com evidência, por exemplo:
- mesmo domínio ou subdomínios (`app.exemplo.com` e `exemplo.com`);
- um projeto cita o endereço ou o repositório de outro (README, configuração, código);
- dependência de um pacote que é outro projeto da pessoa;
- mesmo serviço externo (o mesmo projeto Supabase, Firebase ou API própria), pelo nome no código ou
  na configuração, nunca pelos segredos;
- mesma organização no GitHub ou mesmo prefixo de nome.
- cópias do mesmo projeto em lugares diferentes (`C:\`, `D:\`, Google Drive, pastas `backup`): agrupe
  como um projeto só, aponte qual parece ser a cópia principal (a alterada mais recentemente ou com
  git) e liste as outras como cópias.
Classifique cada ligação pela força da evidência, porque "mesmo tema" ou "mesmo domínio" não prova
integração técnica:
- **comprovada:** um arquivo mostra a ligação (um importa, chama, publica ou alimenta o outro);
- **estratégica:** a pessoa confirma que existe, mas não há prova técnica nos arquivos;
- **hipótese:** palpite seu (nome parecido, mesmo tema), ainda sem confirmação.
Mostre cada ligação com o motivo e a evidência, e peça para a pessoa confirmar, corrigir e acrescentar
as que só ela sabe ("o site X manda clientes para o sistema Y").

**Nomes iguais:** coisas diferentes com o mesmo nome (uma obra, um repositório e um plugin chamados
"O Arco") viram itens separados, com `id` diferentes, mesmo quando dividem pasta ou repositório.

**Hierarquia:** separe os níveis, porque é isso que mostra quantos projetos independentes existem e
quais já podem trabalhar juntos:
- **ecossistema:** guarda-chuva de vários projetos (por exemplo, uma marca que reúne tudo);
- **plataforma** ou **produto:** algo que um usuário usa (um site, um app, um jogo);
- **módulo:** parte de uma plataforma (inbox, mapa, planos);
- **ativo:** dados ou acervo compartilhado por vários (uma base de empresas, um catálogo de músicas);
- **ferramenta:** script ou utilitário interno;
- **obra** ou **iniciativa:** projeto que não é software (música, livro, negócio, imóvel).
Cada item aponta para o seu pai em `projeto_pai`.

## 6. Situação de cada projeto
Registre três coisas separadas, porque elas podem coexistir (um site publicado pode estar em
desenvolvimento ativo, e um produto sem mudanças no código pode estar operando e faturando):
- **`publicacao`:** `publicado` (o endereço responde a `curl -sI <url>` com 200 ou 30x; isso não prova
  que todas as funções funcionam), `nao_publicado` ou `desconhecido`.
- **`atividade`:** `em_andamento` (alteração nos últimos 30 dias), `sem_alteracao_recente` (a cópia
  examinada não muda há mais de 30 dias; não diga "pausado" sem a pessoa confirmar), `pausado` ou
  `arquivado` (só quando a pessoa ou o GitHub disser).
- **`verificacao`:** `verificado` (achei pasta, repositório ou site), `registrado` (veio de uma lista
  ou da memória da pessoa, sem confirmação) ou `parcial`.
Seja preciso nas conclusões: "não achei remoto git nas cópias examinadas e não está na lista de
repositórios da conta X" é diferente de "não tem cópia no GitHub". Pergunte à pessoa só sobre os que
ficaram em dúvida.

## 7. Entregar
1. Uma tabela curta, em linguagem simples: projeto, o que é, situação, onde está publicado, onde está
   no computador. Agrupe por rede ou tema se houver muitos.
2. Um desenho das conexões em texto (ou Mermaid, se a pessoa preferir), por exemplo:
   `site-principal → sistema-agendamento (manda clientes)`.
3. O arquivo `projetos.json`, gravado onde a pessoa escolher (sugira a pasta desta sessão), neste
   formato:

```json
{
  "atualizado_em": "AAAA-MM-DD",
  "projetos": [
    {
      "id": "sistema-agendamento",
      "nome": "Sistema de agendamento",
      "tipo": "plataforma",
      "projeto_pai": "minha-marca",
      "descricao": "Agenda online para clientes",
      "publicacao": "publicado",
      "atividade": "em_andamento",
      "verificacao": "verificado",
      "visibilidade": "publica",
      "descricao_publica": "Agende um horário online, pelo celular",
      "endereco": "https://agenda.exemplo.com",
      "repositorio": "https://github.com/dono/sistema-agendamento",
      "caminho_local": "C:/Users/NOME/Documents/sistema-agendamento",
      "tecnologias": ["Next.js", "Supabase"],
      "ultima_alteracao": "AAAA-MM-DD",
      "conexoes": [
        { "com": "site-principal", "motivo": "recebe clientes do site", "evidencia": "comprovada", "fonte": "link no index.html do site" }
      ],
      "proximo_passo": "colocar testes e proteção de segredos"
    }
  ]
}
```

O inventário é interno: guarda caminhos, backups e itens privados. Por isso cada item tem
`visibilidade` (`publica`, `restrita` ou `privada`) e uma `descricao_publica` escrita para clientes.
Uma página pública gerada a partir do arquivo mostra só os itens públicos, só a `descricao_publica`,
e nunca caminhos locais.

4. Três próximos passos sugeridos, escritos como a pessoa diria. Por exemplo: "crie uma página que
   mostra esse mapa" (skill `autonomo:novo-projeto`, usando o `projetos.json` como dados), "coloque
   proteção de segredos e testes no projeto X", "publique o projeto Y" (skill `autonomo:implantar`).

Ofereça também a skill `autonomo:central`: transforma esta pasta numa central para acompanhar e
alterar todos os projetos pelo nome.

Termine dizendo que nada foi alterado nos projetos e que basta pedir "atualize o mapa dos meus
projetos" para rodar de novo.
