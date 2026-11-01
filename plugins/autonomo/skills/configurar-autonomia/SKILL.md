---
name: configurar-autonomia
description: Configura quanto o Claude pode fazer sem pedir aprovação (níveis 0 a 3), aplicando permissões, regras que protegem segredos e bloqueiam ações destrutivas, sandbox e instruções permanentes, sempre com consentimento, backup e verificação. Use quando a pessoa quiser mais autonomia, menos pedidos de permissão, ou revisar o nível atual.
---

# Configurar a autonomia

Carregue antes, com a ferramenta Skill: `autonomo:como-ensinar` (se ainda não carregou nesta sessão)
e `autonomo:niveis`. Nunca leia arquivos do plugin com Read.

## 1. Saber onde estamos
Se o diagnóstico ainda não rodou nesta sessão, rode `bash "${CLAUDE_PLUGIN_ROOT}/skills/diagnostico/diagnostico.sh"`
(no Windows, o equivalente em PowerShell descrito na skill `diagnostico`). Anote: sistema, se é
ambiente isolado, modo atual, se o sandbox tem dependências.

## 2. Escolher o nível com a pessoa
Mostre a tabela de níveis com a coluna "Como explicar" e pergunte (AskUserQuestion):
- Máquina pessoal: recomende o **Nível 2 · Autônomo com barreiras**. Ofereça 0 e 1 como alternativas.
- Ambiente isolado (`isolado: sim`): ofereça também o Nível 3.
- Se ela pedir "autorizar tudo" numa máquina pessoal, explique em duas frases por que o Nível 3 só
  roda isolado (um erro ou um arquivo malicioso teria acesso a tudo dela) e ofereça o caminho:
  Nível 2 agora, e Nível 3 num dev container ou em https://claude.ai/code.

## 3. Avisar sobre a aprovação que vai aparecer
Os arquivos de configuração do Claude ficam numa pasta protegida. Diga antes:
"Vou alterar minhas próprias configurações. O Claude Code vai pedir sua aprovação. Escolha
**Yes, and allow Claude to edit files in its ~/.claude folder for this session**."
Isso é esperado e é uma proteção: o Claude não pode mudar as próprias regras sem você.

## 4. Backup
Se `~/.claude/settings.json` existir, copie para `~/.claude/settings.json.backup-AAAAMMDD-HHMM` (data e
hora atuais) e diga o caminho à pessoa. Faça o mesmo com `~/.claude/CLAUDE.md`.

## 5. Mesclar a configuração do nível
Modelos na skill `autonomo:modelos` (carregue com a ferramenta Skill):
- Nível 1: `usuario-nivel-1-assistido.json`
- Nível 2: `usuario-nivel-2-autonomo.json`
- Nível 3: `usuario-nivel-2-autonomo.json` também (as regras de bloqueio continuam valendo dentro do
  contêiner; foi testado que regras `deny` funcionam até com `bypassPermissions`)

Mescle o modelo em `~/.claude/settings.json` **sem apagar nada do que a pessoa já tinha**:
- Listas (`permissions.allow`, `ask`, `deny`, `sandbox.network.allowedDomains`,
  `sandbox.excludedCommands`): una as duas, sem duplicar.
- `permissions.defaultMode`: use o do nível. Se o arquivo tinha `bypassPermissions` e a máquina não
  é isolada, explique o risco e só mantenha com confirmação explícita.
- Demais chaves: preserve as da pessoa; acrescente as do modelo que não existirem.
- No Nível 1, não acrescente o bloco `sandbox` (ele faz mais sentido com o modo auto), a não ser que
  a pessoa peça.
- Escreva JSON válido, sem comentários.

No Windows nativo, `~` é `%USERPROFILE%` (por exemplo `C:\Users\Nome\.claude\settings.json`).

## 6. Dependências do sandbox (Nível 2, Linux e WSL)
Se faltar `bubblewrap` ou `socat`, explique: "Sem isso, a proteção de arquivos fica desligada em
silêncio." Instale com consentimento (`sudo apt-get install -y bubblewrap socat` no Ubuntu/Debian;
`sudo dnf install -y bubblewrap socat` no Fedora). No macOS o sandbox já vem pronto. No Windows
nativo o sandbox não está disponível: recomende o WSL ou um dev container para o Nível 2 completo,
ou siga com as regras de bloqueio sem sandbox, dizendo que leituras indiretas de segredos não ficam
cobertas.

## 7. Instruções permanentes
Pegue o modelo `claude-md-usuario.md` da skill `autonomo:modelos`, preencha `{{PERFIL}}` (por exemplo
"iniciante em programação" ou "desenvolvedora experiente"), `{{IDIOMA}}`, `{{NIVEL}}` e `{{DATA}}`,
e grave em `~/.claude/CLAUDE.md`:
- se já houver um bloco entre `<!-- autonomo:inicio` e `<!-- autonomo:fim -->`, substitua só ele;
- senão, acrescente ao final, preservando o resto do arquivo.

## 8. Validar
Rode `claude doctor` e confira que não há "Invalid settings". Se houver, corrija o JSON e rode de
novo. Mostre à pessoa a linha que confirma.

## 9. Aplicar e provar
- Explique que o novo modo vale a partir da próxima sessão. Peça para ela digitar `/exit` e abrir de
  novo com `claude --continue` (retoma esta conversa) na mesma pasta.
- Na sessão nova, confira o modo no rodapé da tela. No Nível 2 deve aparecer **auto mode**. Se
  aparecer Manual, o modo auto não está disponível para a conta ou o modelo; ofereça o Nível 1 e
  explique a diferença.
- Carregue e siga a skill `autonomo:verificar-barreiras` e mostre o resultado.

## Nível 3 (só ambiente isolado)
- Sessão na nuvem: https://claude.ai/code roda num contêiner da Anthropic; a pessoa conecta o GitHub
  e escolhe o repositório. Não precisa configurar nada local.
- Dev container: siga https://code.claude.com/docs/pt/devcontainer com a pessoa (precisa de Docker
  Desktop e VS Code). Dentro do contêiner, aplique o modelo do Nível 2 e use
  `claude --dangerously-skip-permissions`, como usuário que não seja root.
- Nunca grave `bypassPermissions` como `defaultMode` em `~/.claude/settings.json` de uma máquina
  pessoal.

## Desfazer
Se a pessoa quiser voltar atrás: restaure o backup do passo 4 (`cp` do arquivo de backup para
`settings.json`) e remova o bloco `autonomo` do `CLAUDE.md`. Diga isso no resumo final.
