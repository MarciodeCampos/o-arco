"""
Lab 5.3 (parte 2) — Um cliente MCP: descobre e usa o que o servidor oferece.

O cliente inicia o servidor como subprocesso (transporte stdio), pergunta quais
ferramentas, recursos e prompts existem, e chama alguns deles. É exatamente o
que Claude Code, Claude Desktop e IDEs fazem por baixo dos panos.

    python cliente_loja.py
"""
import asyncio
import json
import sys
from pathlib import Path

from mcp import Client, StdioServerParameters

SERVIDOR = StdioServerParameters(command=sys.executable, args=[str(Path(__file__).parent / "servidor_loja.py")])


def texto(resultado) -> str:
    # Ferramentas que devolvem dados trazem também `structured_content` (JSON pronto para o código).
    if resultado.structured_content and not resultado.is_error:
        return json.dumps(resultado.structured_content, ensure_ascii=False)
    bruto = " ".join(getattr(c, "text", "") for c in resultado.content)
    try:
        return json.dumps(json.loads(bruto), ensure_ascii=False)  # compacta JSON em uma linha
    except ValueError:
        return bruto


def uma_linha(s: str, n: int) -> str:
    return " ".join(s.split())[:n]


async def main():
    async with Client(SERVIDOR) as cliente:
        print(f"Conectado a: {cliente.server_info.name}\n")

        print("FERRAMENTAS")
        for f in (await cliente.list_tools()).tools:
            dica = f.annotations.destructive_hint if f.annotations else None
            print(f"  • {f.name}{'  ⚠ destrutiva' if dica else ''}\n    {f.description}")
            print(f"    parâmetros: {json.dumps(f.input_schema.get('properties', {}), ensure_ascii=False)}")

        print("\nRECURSOS")
        for r in (await cliente.list_resources()).resources:
            print(f"  • {r.uri}  ({r.mime_type})")
        for t in (await cliente.list_resource_templates()).resource_templates:
            print(f"  • {t.uri_template}  (modelo)")

        print("\nPROMPTS")
        for p in (await cliente.list_prompts()).prompts:
            print(f"  • {p.name}: {', '.join(a.name for a in p.arguments or [])}")

        print("\nCHAMADAS")
        r = await cliente.call_tool("consultar_pedido", {"numero": "4821"})
        print(f"  consultar_pedido(4821) → {texto(r)}")
        r = await cliente.call_tool("calcular_frete", {"cep": "30140-071", "peso_kg": 2.4})
        print(f"  calcular_frete(...)    → {texto(r)}")
        r = await cliente.call_tool("consultar_pedido", {"numero": "9999"})
        print(f"  consultar_pedido(9999) → erro={r.is_error}: {texto(r)}")

        politica = await cliente.read_resource("loja://politicas/trocas")
        print(f"\n  recurso loja://politicas/trocas → {uma_linha(politica.contents[0].text, 80)}...")

        prompt = await cliente.get_prompt("responder_reclamacao", {"numero_pedido": "4821", "reclamacao": "Está atrasado!"})
        print(f"  prompt responder_reclamacao → {uma_linha(prompt.messages[0].content.text, 80)}...")


asyncio.run(main())
