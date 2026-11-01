"""
Hook PreToolUse: roda ANTES de o agente editar ou criar um arquivo.

Recebe no stdin um JSON com a chamada (tool_name, tool_input). Se o arquivo for
protegido, sai com código 2: a ação é bloqueada e a mensagem do stderr volta para o
agente, que entende por quê. Código 0 libera.

Hooks são a forma de impor regras que NÃO dependem do modelo obedecer ao CLAUDE.md:
o modelo pode esquecer uma instrução; o hook não esquece.

Teste sem agente:
    echo '{"tool_name":"Edit","tool_input":{"file_path":".env"}}' | python3 proteger_arquivos.py; echo $?
"""
import json
import re
import sys
from pathlib import Path

# (padrão, motivo, só_se_já_existir)
PROTEGIDOS = [
    (r"(^|/)\.env(\..*)?$", "arquivos .env contêm segredos", False),
    # Testes NOVOS são bem-vindos (o CLAUDE.md exige); alterar testes EXISTENTES, não.
    (r"(^|/)test/.*\.test\.ts$", "testes existentes não podem ser alterados pelo agente; explique ao humano se um teste parecer errado", True),
    (r"(^|/)specs/.*\.aceitacao\.test\.ts$", "testes de aceitação são o contrato da spec", False),
    (r"(^|/)package-lock\.json$", "dependências só mudam com aprovação humana", False),
    (r"(^|/)\.github/workflows/", "pipelines de CI só mudam com revisão humana", False),
]

try:
    chamada = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)  # entrada inesperada: não bloqueia (o hook não deve quebrar o fluxo normal)

caminho = str((chamada.get("tool_input") or {}).get("file_path", ""))
for padrao, motivo, so_existentes in PROTEGIDOS:
    if re.search(padrao, caminho) and (not so_existentes or Path(caminho).exists()):
        print(f"Bloqueado pelo hook do projeto: {caminho} — {motivo}.", file=sys.stderr)
        sys.exit(2)
sys.exit(0)
