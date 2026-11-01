---
name: diagnostico
description: Verifica o ambiente da pessoa (sistema, Claude Code, git, Node, Python, GitHub, sandbox, nível de autonomia configurado) sem alterar nada, e explica o resultado em linguagem simples. Use quando a pessoa perguntar se o computador está pronto, o que falta instalar, ou antes de configurar a autonomia.
---

# Diagnóstico do ambiente

Somente leitura: esta skill não instala nem altera nada.

1. Leia `${CLAUDE_PLUGIN_ROOT}/referencia/como-ensinar.md` se ainda não leu nesta sessão.
2. Diga à pessoa, em uma frase, que vai olhar o que já está instalado, sem mudar nada.
3. Rode o diagnóstico:
   - macOS, Linux ou WSL: `bash "${CLAUDE_SKILL_DIR}/diagnostico.sh"`
   - Windows nativo (PowerShell): colete o equivalente com `$PSVersionTable.PSVersion`,
     `claude --version`, `git --version`, `node --version`, `python --version`, `gh --version`,
     `gh auth status`, `docker --version` e `Test-Path $HOME\.claude\settings.json`. Cada comando que
     falhar significa "não instalado".
4. Rode `claude doctor` e guarde só a seção de configurações inválidas e os avisos.
5. Apresente uma tabela curta, em linguagem simples:

   | Item | Situação | O que significa |
   |---|---|---|
   | Git | ✓ instalado | Guarda o histórico do seu trabalho |
   | Sandbox | ✗ falta bubblewrap | Sem ele, a proteção de arquivos não funciona no Linux |

6. Diga quais itens são **necessários** para o que a pessoa quer fazer e quais são opcionais. Se ela
   ainda não disse o que quer fazer, considere necessários: git, conta e login no GitHub, Node.js ou
   Python (um dos dois) e, no Linux, `bubblewrap` e `socat`.
7. Avisos especiais:
   - `isolado: sim` — é um contêiner ou sessão na nuvem; o Nível 3 é possível.
   - `usuario_root: sim` fora de contêiner — recomende usar uma conta comum.
   - `settings_protege_env: não` com `settings_modo: auto` ou `bypassPermissions` — autonomia sem
     barreira de segredos; recomende `/autonomo:configurar-autonomia`.
   - No Linux, `sandbox_bubblewrap: NÃO` ou `sandbox_socat: NÃO` — o sandbox fica desligado em
     silêncio, mesmo que o settings diga `enabled: true`.
8. Termine sugerindo o próximo passo: `/autonomo:comecar` para quem está começando, ou
   `/autonomo:configurar-autonomia` para quem só quer ajustar as permissões.
