"""
Lab 6.2 — O loop de agente pronto do SDK (tool runner).

No Módulo 2 você escreveu o loop à mão. O SDK oferece um "tool runner" (beta) que
faz o mesmo: você declara funções Python, ele gera os schemas, chama o modelo,
executa as ferramentas e devolve os resultados até o modelo terminar.

Use o runner quando o loop padrão basta. Escreva o seu (como no projeto deste
módulo) quando precisar de orçamento, aprovação humana, poda de contexto e
trajetória sob seu controle.

    python 02_tool_runner.py
    python 02_tool_runner.py "Quanto custa mandar o pedido 4822 para Porto Alegre, CEP 90010-000?"
"""
import sys

import anthropic
from anthropic import beta_tool

PEDIDOS = {
    "4821": {"cliente": "Ana Souza", "peso_kg": 2.4, "status": "separando"},
    "4822": {"cliente": "Bruno Lima", "peso_kg": 0.6, "status": "enviado"},
}
FAIXAS_CEP = {"0": "SP capital", "1": "SP interior", "2": "RJ/ES", "3": "MG", "8": "PR/SC", "9": "RS"}


@beta_tool
def consultar_pedido(numero: str) -> str:
    """Busca um pedido pelo número e devolve cliente, peso em kg e status.

    Args:
        numero: Número do pedido, só dígitos.
    """
    p = PEDIDOS.get(numero)
    return str(p) if p else f"Pedido {numero} não encontrado"


@beta_tool
def calcular_frete(cep: str, peso_kg: float) -> str:
    """Calcula valor e prazo do frete para um CEP de destino e um peso.

    Args:
        cep: CEP de destino, com ou sem hífen.
        peso_kg: Peso total em quilos.
    """
    digitos = "".join(c for c in cep if c.isdigit())
    if len(digitos) != 8:
        return "Erro: CEP deve ter 8 dígitos"
    regiao = FAIXAS_CEP.get(digitos[0], "outras regiões")
    base = 18.0 if regiao.startswith("SP") else 29.0
    return f"Região {regiao}: R$ {base + 6.5 * peso_kg:.2f}, {3 if base == 18 else 6} dias úteis"


pergunta = " ".join(sys.argv[1:]) or "Quanto custa e quanto tempo leva para mandar o pedido 4821 para o CEP 30140-071?"
client = anthropic.Anthropic()

runner = client.beta.messages.tool_runner(
    model="claude-opus-5-5",
    max_tokens=4000,
    system="Você é o atendente de uma loja. Use as ferramentas e responda em português, em até 3 frases.",
    tools=[consultar_pedido, calcular_frete],
    messages=[{"role": "user", "content": pergunta}],
)

# Cada volta do loop produz uma mensagem do modelo; o runner executa as ferramentas entre elas.
for i, mensagem in enumerate(runner, 1):
    for bloco in mensagem.content:
        if bloco.type == "tool_use":
            print(f"[volta {i}] modelo pediu {bloco.name}({bloco.input})")
        elif bloco.type == "text" and bloco.text.strip():
            print(f"[volta {i}] {bloco.text}")
