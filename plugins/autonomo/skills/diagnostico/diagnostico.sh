#!/usr/bin/env bash
# Diagnóstico do ambiente (somente leitura). macOS, Linux e WSL; no Windows nativo a skill usa PowerShell.
# Saída: linhas "chave: valor", fáceis de explicar para a pessoa.

v() { command -v "$1" >/dev/null 2>&1 && "$@" 2>/dev/null | head -1 || echo "não instalado"; }

echo "sistema: $(uname -s) $(uname -m)"
if [ "$(uname -s)" = "Linux" ]; then
  [ -f /etc/os-release ] && echo "distribuicao: $(. /etc/os-release; echo "$PRETTY_NAME")"
  grep -qi microsoft /proc/version 2>/dev/null && echo "wsl: sim" || echo "wsl: não"
fi
if [ -f /.dockerenv ] || [ -n "$REMOTE_CONTAINERS" ] || [ -n "$CODESPACES" ] || [ -n "$CLAUDE_CODE_REMOTE" ]; then
  echo "isolado: sim (contêiner ou nuvem)"
else
  echo "isolado: não (máquina da pessoa)"
fi
echo "usuario_root: $([ "$(id -u)" = 0 ] && echo sim || echo não)"
echo "claude: $(v claude --version)"
echo "git: $(v git --version)"
echo "git_nome: $(git config --global user.name 2>/dev/null || echo 'não configurado')"
echo "git_email: $(git config --global user.email >/dev/null 2>&1 && echo configurado || echo 'não configurado')"
echo "node: $(v node --version)"
echo "npm: $(v npm --version)"
echo "python3: $(v python3 --version)"
echo "gh: $(v gh --version)"
if command -v gh >/dev/null 2>&1; then
  gh auth status >/dev/null 2>&1 && echo "gh_login: sim" || echo "gh_login: não"
fi
echo "docker: $(v docker --version)"
echo "brew: $(v brew --version)"
if [ "$(uname -s)" = "Linux" ]; then
  echo "sandbox_bubblewrap: $(command -v bwrap >/dev/null && echo sim || echo NÃO)"
  echo "sandbox_socat: $(command -v socat >/dev/null && echo sim || echo NÃO)"
fi
S="$HOME/.claude/settings.json"
if [ -f "$S" ]; then
  echo "settings_usuario: existe"
  modo=$(grep -o '"defaultMode"[^,}]*' "$S" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
  echo "settings_modo: ${modo:-padrão (manual)}"
  grep -q '"sandbox"' "$S" && echo "settings_sandbox: configurado" || echo "settings_sandbox: não configurado"
  grep -q 'Read(//\*\*/.env)' "$S" && echo "settings_protege_env: sim" || echo "settings_protege_env: não"
else
  echo "settings_usuario: não existe"
fi
grep -q 'autonomo:inicio' "$HOME/.claude/CLAUDE.md" 2>/dev/null && echo "claude_md_autonomo: sim" || echo "claude_md_autonomo: não"
