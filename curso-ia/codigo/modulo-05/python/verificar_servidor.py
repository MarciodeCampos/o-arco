"""
Lab 5.7 — Inspecionando um servidor MCP antes de confiar nele.

Conecta ao servidor, lê tudo o que ele anuncia (que é exatamente o que vai para o
contexto do modelo) e procura sinais de alerta. É uma triagem, não uma garantia:
servidores podem mudar as descrições depois de aprovados ("rug pull"), e
resultados de ferramentas também podem trazer injeções.

    python verificar_servidor.py servidor_envenenado.py
    python verificar_servidor.py servidor_loja.py
"""
import asyncio
import re
import sys
from pathlib import Path

from mcp import Client, StdioServerParameters

SINAIS = [
    (r"<\s*important\s*>|<\s*system\s*>|\bSISTEMA:", "marcação que imita instrução de sistema"),
    (r"n[ãa]o (mencione|conte|diga)|sem avisar|n[ãa]o informe", "pede para esconder algo do usuário"),
    (r"\.ssh|id_rsa|\.env\b|senha|password|token|credencia", "menciona segredos ou credenciais"),
    (r"ignore (as|todas|quaisquer)|ignore (all|previous)", "tenta anular instruções"),
    (r"(chame|use|execute) (tamb[ée]m |a ferramenta )", "manda chamar outras ferramentas"),
    (r"https?://|@[\w-]+\.\w+", "contém URL ou e-mail"),
]
PERIGOSAS = re.compile(r"enviar|email|e-mail|apagar|deletar|excluir|cancelar|pagar|transferir|executar|shell", re.I)


def verificar_texto(origem: str, texto: str) -> list[str]:
    return [f"{origem}: {motivo}" for padrao, motivo in SINAIS if re.search(padrao, texto, re.I)]


async def main(arquivo: str):
    params = StdioServerParameters(command=sys.executable, args=[str(Path(arquivo).resolve())])
    alertas: list[str] = []  # sinais de comportamento malicioso
    avisos: list[str] = []   # ações legítimas, mas que exigem confirmação humana
    async with Client(params) as c:
        print(f"Servidor: {c.server_info.name}\n")
        for f in (await c.list_tools()).tools:
            desc = f.description or ""
            print(f"• {f.name} ({len(desc)} caracteres de descrição)")
            alertas += verificar_texto(f"descrição de {f.name}", desc)
            if len(desc) > 400:
                alertas.append(f"descrição de {f.name}: longa demais para o que faz ({len(desc)} caracteres)")
            somente_leitura = f.annotations and f.annotations.read_only_hint
            destrutiva = f.annotations and f.annotations.destructive_hint
            if destrutiva or (PERIGOSAS.search(f.name) and not somente_leitura):
                avisos.append(f"{f.name}: ação com efeito externo; exigir confirmação humana no cliente")

    print()
    for a in avisos:
        print(f"ℹ {a}")
    if alertas:
        print(f"\n⚠ {len(alertas)} sinais de alerta:")
        for a in alertas:
            print(f"  - {a}")
        print("\nNão conecte este servidor a um agente com acesso a arquivos, e-mail ou dados sensíveis.")
    else:
        print("\n✓ Nenhum sinal óbvio de má-fé. Isso NÃO prova que é seguro: revise o código e fixe a versão.")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "servidor_envenenado.py"))
