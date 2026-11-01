"""
Lab 2.5 — Tool calling: o modelo pede, o seu código executa.

O modelo NÃO executa nada. Ele devolve um pedido estruturado ("chame
consultar_pedido com numero=4821"); seu código decide se executa, executa e
devolve o resultado. Esse vai-e-vem é a base de todo agente (Módulo 6).

    python 03_ferramentas.py
    python 03_ferramentas.py "Quanto custa mandar o pedido 4821 para o CEP 30140-071?"
"""
import json
import sys

import anthropic

MODELO = "claude-opus-5-5"

# ------------------------------------------------------------------ "banco de dados" de exemplo
PEDIDOS = {
    "4821": {"cliente": "Ana Souza", "itens": 3, "peso_kg": 2.4, "status": "separando"},
    "4822": {"cliente": "Bruno Lima", "itens": 1, "peso_kg": 0.6, "status": "enviado"},
}
FAIXAS_CEP = {"0": "SP capital", "1": "SP interior", "2": "RJ/ES", "3": "MG", "8": "PR/SC", "9": "RS"}


# ------------------------------------------------------------------ as ferramentas (código comum)
def consultar_pedido(numero: str) -> dict:
    pedido = PEDIDOS.get(numero)
    if pedido is None:
        raise ValueError(f"Pedido {numero} não encontrado")
    return pedido


def calcular_frete(cep: str, peso_kg: float) -> dict:
    digitos = "".join(c for c in cep if c.isdigit())
    if len(digitos) != 8:
        raise ValueError("CEP deve ter 8 dígitos")
    regiao = FAIXAS_CEP.get(digitos[0], "outras regiões")
    base = 18.0 if regiao.startswith("SP") else 29.0
    return {"regiao": regiao, "valor_reais": round(base + 6.5 * peso_kg, 2), "prazo_dias": 3 if base == 18 else 6}


EXECUTORES = {"consultar_pedido": consultar_pedido, "calcular_frete": calcular_frete}

# ------------------------------------------------------------------ como o modelo enxerga as ferramentas
# A descrição é um prompt: diga o que faz, quando usar e o que devolve.
FERRAMENTAS = [
    {
        "name": "consultar_pedido",
        "description": "Busca um pedido pelo número. Devolve cliente, quantidade de itens, peso total em kg e status.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {"numero": {"type": "string", "description": "Número do pedido, só dígitos"}},
            "required": ["numero"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calcular_frete",
        "description": "Calcula valor e prazo de frete para um CEP de destino e um peso em kg.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "cep": {"type": "string", "description": "CEP de destino, com ou sem hífen"},
                "peso_kg": {"type": "number"},
            },
            "required": ["cep", "peso_kg"],
            "additionalProperties": False,
        },
    },
]

pergunta = " ".join(sys.argv[1:]) or "Quanto custa e quanto tempo leva para enviar o pedido 4821 para o CEP 30140-071?"
client = anthropic.Anthropic()
mensagens: list[anthropic.types.MessageParam] = [{"role": "user", "content": pergunta}]

for rodada in range(1, 6):  # limite de segurança: nunca deixe um loop de ferramentas sem teto
    resposta = client.messages.create(
        model=MODELO,
        max_tokens=4000,
        system="Você é o atendente de uma loja online. Use as ferramentas para responder com dados reais. Responda em português.",
        tools=FERRAMENTAS,
        messages=mensagens,
        output_config={"effort": "low"},
    )
    mensagens.append({"role": "assistant", "content": resposta.content})

    if resposta.stop_reason != "tool_use":
        break

    resultados = []
    for bloco in resposta.content:
        if bloco.type != "tool_use":
            continue
        print(f"[rodada {rodada}] modelo pediu: {bloco.name}({json.dumps(bloco.input, ensure_ascii=False)})")
        try:
            saida = EXECUTORES[bloco.name](**bloco.input)
            resultados.append({"type": "tool_result", "tool_use_id": bloco.id, "content": json.dumps(saida, ensure_ascii=False)})
            print(f"           resultado: {saida}")
        except Exception as erro:  # erros voltam para o modelo, que pode se corrigir ou avisar o usuário
            resultados.append({"type": "tool_result", "tool_use_id": bloco.id, "content": str(erro), "is_error": True})
            print(f"           erro: {erro}")
    # Todos os resultados vão juntos, em UMA mensagem de usuário.
    mensagens.append({"role": "user", "content": resultados})
else:
    print("[limite de rodadas atingido]")

texto = "".join(b.text for b in resposta.content if b.type == "text")
print(f"\nResposta final:\n{texto}")
