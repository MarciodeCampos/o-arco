"""
Lab 5.3 (parte 3) — Testando um servidor MCP sem subprocesso nem rede.

O Client aceita a instância do servidor diretamente e conversa com ela em memória.

    python test_servidor_loja.py
"""
import asyncio

from mcp import Client

from servidor_loja import loja


async def main():
    async with Client(loja) as c:
        nomes = sorted(t.name for t in (await c.list_tools()).tools)
        assert nomes == ["calcular_frete", "cancelar_pedido", "consultar_pedido"], nomes

        cancelar = next(t for t in (await c.list_tools()).tools if t.name == "cancelar_pedido")
        assert cancelar.annotations.destructive_hint is True, "ação irreversível precisa ser marcada"

        r = await c.call_tool("calcular_frete", {"cep": "01310-100", "peso_kg": 1})
        assert not r.is_error and "SP capital" in r.content[0].text

        r = await c.call_tool("calcular_frete", {"cep": "123", "peso_kg": 1})
        assert r.is_error and "8 dígitos" in r.content[0].text, "erro previsto deve chegar legível"

        r = await c.call_tool("cancelar_pedido", {"numero": "4822", "motivo": "teste"})
        assert r.is_error and "já enviado" in r.content[0].text

        r = await c.call_tool("calcular_frete", {"cep": "01310-100"})  # falta peso_kg
        assert r.is_error, "argumentos inválidos devem ser recusados pelo schema"

        recurso = await c.read_resource("loja://pedidos/4821")
        assert "Ana Souza" in recurso.contents[0].text

    print("✓ todos os testes do servidor da loja passaram")


asyncio.run(main())
