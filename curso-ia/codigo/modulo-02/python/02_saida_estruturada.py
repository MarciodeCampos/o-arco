"""
Lab 2.4 — Saída estruturada: transformar texto livre em dados validados.

Um e-mail de cliente entra, um objeto Python tipado sai. Sem regex frágil,
sem "por favor responda só JSON" no prompt torcendo para dar certo.

    python 02_saida_estruturada.py
    python 02_saida_estruturada.py ../dados/email_cliente_2.txt
"""
import sys
from enum import Enum
from pathlib import Path

import anthropic
from pydantic import BaseModel, Field

MODELO = "claude-opus-5-5"


class Prioridade(str, Enum):
    baixa = "baixa"
    media = "media"
    alta = "alta"
    critica = "critica"


class Categoria(str, Enum):
    cobranca = "cobranca"
    bug = "bug"
    duvida = "duvida"
    cancelamento = "cancelamento"
    elogio = "elogio"
    outro = "outro"


class Chamado(BaseModel):
    """Um chamado de suporte extraído de uma mensagem de cliente."""

    nome_cliente: str | None = Field(description="Nome de quem escreveu, se aparecer")
    email_cliente: str | None
    categoria: Categoria
    prioridade: Prioridade = Field(description="critica = sistema fora do ar ou perda de dinheiro")
    resumo: str = Field(description="Uma frase, no máximo 20 palavras")
    produtos_citados: list[str]
    pede_reembolso: bool
    sentimento: int = Field(description="De -2 (muito irritado) a 2 (muito satisfeito)")


arquivo = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "dados" / "email_cliente_1.txt"
mensagem = arquivo.read_text(encoding="utf-8")

client = anthropic.Anthropic()

resposta = client.messages.parse(
    model=MODELO,
    max_tokens=4000,
    system="Você classifica mensagens de clientes para a equipe de suporte. Extraia apenas o que está no texto.",
    messages=[
        {
            "role": "user",
            # Dados do usuário delimitados por tags: o modelo sabe onde começa e termina o e-mail.
            "content": f"<email>\n{mensagem}\n</email>\n\nExtraia o chamado deste e-mail.",
        }
    ],
    output_config={"effort": "low"},
    output_format=Chamado,
)

if resposta.stop_reason == "refusal":
    sys.exit("O modelo recusou a solicitação.")

chamado = resposta.parsed_output
if chamado is None:
    sys.exit("Não foi possível interpretar a resposta.")

print(chamado.model_dump_json(indent=2))

# Agora é só código normal, com tipos:
if chamado.prioridade in (Prioridade.alta, Prioridade.critica):
    print(f"\n🚨 Encaminhar para o plantão: {chamado.resumo}")
if chamado.pede_reembolso:
    print("💸 Abrir fluxo de reembolso")

print(f"\n[{resposta.usage.input_tokens} tokens in / {resposta.usage.output_tokens} out]")
