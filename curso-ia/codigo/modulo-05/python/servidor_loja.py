"""
Lab 5.3 — Seu primeiro servidor MCP, em Python.

As mesmas ferramentas da loja do Módulo 2 (consultar pedido, calcular frete),
agora expostas por MCP: qualquer cliente compatível (Claude Code, Claude Desktop,
IDEs, o MCP Inspector, seus próprios agentes) passa a usá-las sem integração nova.

Expõe as três primitivas do protocolo:
  - ferramentas (tools):  ações que o MODELO decide chamar
  - recursos (resources): dados que a APLICAÇÃO pode ler e colocar no contexto
  - prompts:              modelos de mensagem que o USUÁRIO escolhe usar

Rodar (transporte stdio, o padrão para servidores locais):
    python servidor_loja.py
Inspecionar no navegador:
    npx @modelcontextprotocol/inspector python servidor_loja.py
"""
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ResourceNotFoundError, ToolError
from mcp.types import ToolAnnotations

loja = MCPServer(
    name="loja-exemplo",
    instructions="Ferramentas da loja online de exemplo: pedidos, frete e política de trocas.",
)

PEDIDOS = {
    "4821": {"cliente": "Ana Souza", "itens": 3, "peso_kg": 2.4, "status": "separando"},
    "4822": {"cliente": "Bruno Lima", "itens": 1, "peso_kg": 0.6, "status": "enviado"},
}
FAIXAS_CEP = {"0": "SP capital", "1": "SP interior", "2": "RJ/ES", "3": "MG", "8": "PR/SC", "9": "RS"}


# ---------------------------------------------------------------- ferramentas
# A docstring vira a descrição que o modelo lê; os tipos viram o JSON Schema.
# Erros PREVISTOS: lance ToolError, e a mensagem chega ao modelo, que pode se corrigir.
# Qualquer outra exceção é tratada como falha inesperada: o cliente recebe só uma mensagem
# genérica, para não vazar detalhes internos (caminhos, SQL, stack traces).
@loja.tool(annotations=ToolAnnotations(read_only_hint=True))
def consultar_pedido(numero: str) -> dict:
    """Busca um pedido pelo número. Devolve cliente, quantidade de itens, peso total em kg e status."""
    pedido = PEDIDOS.get(numero)
    if pedido is None:
        raise ToolError(f"Pedido {numero} não encontrado")
    return pedido


@loja.tool(annotations=ToolAnnotations(read_only_hint=True))
def calcular_frete(cep: str, peso_kg: float) -> dict:
    """Calcula valor (em reais) e prazo (em dias úteis) de frete para um CEP de destino e um peso em kg."""
    digitos = "".join(c for c in cep if c.isdigit())
    if len(digitos) != 8:
        raise ToolError("CEP deve ter 8 dígitos")
    regiao = FAIXAS_CEP.get(digitos[0], "outras regiões")
    base = 18.0 if regiao.startswith("SP") else 29.0
    return {"regiao": regiao, "valor_reais": round(base + 6.5 * peso_kg, 2), "prazo_dias": 3 if base == 18 else 6}


@loja.tool(annotations=ToolAnnotations(read_only_hint=False, destructive_hint=True))
def cancelar_pedido(numero: str, motivo: str) -> str:
    """Cancela um pedido que ainda não foi enviado. AÇÃO IRREVERSÍVEL: confirme com o cliente antes."""
    pedido = PEDIDOS.get(numero)
    if pedido is None:
        raise ToolError(f"Pedido {numero} não encontrado")
    if pedido["status"] == "enviado":
        raise ToolError("Pedido já enviado: não pode ser cancelado, só devolvido")
    pedido["status"] = "cancelado"
    return f"Pedido {numero} cancelado. Motivo registrado: {motivo}"


# ---------------------------------------------------------------- recursos
@loja.resource("loja://politicas/trocas", mime_type="text/markdown")
def politica_de_trocas() -> str:
    """Política de trocas e devoluções da loja."""
    return (
        "# Trocas e devoluções\n\n"
        "- Arrependimento: até 7 dias após o recebimento, com reembolso integral.\n"
        "- Defeito: troca em até 30 dias; depois disso, garantia do fabricante.\n"
    )


@loja.resource("loja://pedidos/{numero}")
def pedido_como_recurso(numero: str) -> dict:
    """Os dados de um pedido, para a aplicação anexar ao contexto."""
    if numero not in PEDIDOS:
        raise ResourceNotFoundError(f"Pedido {numero} não encontrado")
    return PEDIDOS[numero]


# ---------------------------------------------------------------- prompts
@loja.prompt(title="Responder reclamação")
def responder_reclamacao(numero_pedido: str, reclamacao: str) -> str:
    """Modelo de mensagem para responder a reclamação de um cliente sobre um pedido."""
    return (
        f"Um cliente reclamou do pedido {numero_pedido}:\n\n<reclamacao>\n{reclamacao}\n</reclamacao>\n\n"
        "Consulte o pedido com as ferramentas, leia a política de trocas e escreva uma resposta "
        "cordial, em até 5 frases, com os próximos passos concretos."
    )


if __name__ == "__main__":
    loja.run()  # stdio
