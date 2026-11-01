---
name: skills-recomendadas
description: Recomenda e instala, com a aprovação da pessoa, plugins e skills prontos que ampliam o que o Claude sabe fazer (design de páginas, testes no navegador, GitHub, publicação, documentos, revisão de código), escolhidos pelo tipo de projeto dela. Use quando a pessoa pedir uma biblioteca de skills, perguntar o que mais o Claude pode fazer, ou ao terminar de mapear ou criar um projeto.
---

# Skills recomendadas

Carregue a skill `autonomo:como-ensinar` (ferramenta Skill) se ainda não carregou nesta sessão.

Explique em duas frases: uma skill é um conjunto de instruções que ensina o Claude a fazer um tipo de
trabalho; um plugin é um pacote com uma ou mais skills (como este, o `autonomo`). Plugins de terceiros
rodam com as mesmas permissões que o Claude, então só recomende os das fontes abaixo.

## Fontes confiáveis
| Marketplace | Como adicionar | O que tem |
|---|---|---|
| `claude-plugins-official` (diretório oficial de plugins da Anthropic) | já vem no Claude Code; se não aparecer em `/plugin`, `/plugin marketplace add anthropics/claude-plugins-official` | centenas de plugins revisados, de empresas e da Anthropic |
| `anthropic-agent-skills` (skills de exemplo da Anthropic) | `/plugin marketplace add anthropics/skills` | documentos (Word, Excel, PowerPoint, PDF), design, testes de aplicativos web, criação de skills |

Antes de recomendar, confira que o plugin ainda existe: `claude plugin marketplace update` e depois
`/plugin` (aba Discover), ou procure o nome na lista do marketplace. Os nomes mudam com o tempo.

## Escolher pelo perfil
Recomende **no máximo quatro**, explicando cada um em uma frase do ponto de vista da pessoa. Ponto de
partida (confirme os nomes antes):

| Se a pessoa... | Sugira | Para quê |
|---|---|---|
| faz sites ou páginas | `frontend-design@claude-plugins-official` | páginas com visual profissional, não genérico |
| quer ver a página funcionando | `playwright@claude-plugins-official` | o Claude abre o navegador, clica e confere |
| usa GitHub | `github@claude-plugins-official` e `commit-commands@claude-plugins-official` | issues, pull requests e commits com um comando |
| publica na Vercel, Netlify ou Cloudflare | `vercel@claude-plugins-official` (ou `cloudflare`) | publicar e ver logs sem sair do Claude |
| tem vários projetos | `claude-md-management@claude-plugins-official` | manter o `CLAUDE.md` de cada projeto em dia |
| quer revisar o que o Claude fez | `code-review@claude-plugins-official` e `security-guidance@claude-plugins-official` | revisão de código e de segurança |
| trabalha com documentos | `document-skills@anthropic-agent-skills` | criar e editar Word, Excel, PowerPoint e PDF |
| quer criar as próprias skills | `skill-creator@claude-plugins-official` | transformar um jeito de trabalhar numa skill |
| usa banco de dados Supabase | `supabase@claude-plugins-official` | consultar e alterar o banco com segurança |

## Instalar (com aprovação)
1. Mostre a lista curta e pergunte quais instalar (AskUserQuestion com várias escolhas).
2. Para cada uma, peça para a pessoa digitar no Claude, uma linha por vez:
   `/plugin install <nome>@<marketplace>`
   e escolher **"Install for you (user scope)"** (vale em todos os projetos). Avise antes que essa
   tela é em inglês e diga qual opção escolher.
3. Depois, `/reload-plugins` para ativar sem reiniciar.
4. Mostre como usar cada um com um pedido de exemplo, escrito como ela diria.

Plugins que conectam serviços (GitHub, Vercel, Supabase) podem pedir login: siga a seção "Logins
pelo navegador" da skill `autonomo:como-ensinar`. Para remover um plugin: `/plugin` e a aba Installed.
