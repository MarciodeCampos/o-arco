"""
Lab 8.3 — Visão: extrair dados de uma FOTO de cupom fiscal.

A foto (dados/cupom.jpg) está levemente torta e borrada, como uma foto real de
celular. O modelo lê a imagem diretamente: não há OCR separado.

    python 01_visao.py
    python 01_visao.py caminho/para/sua_foto.jpg
"""
import base64
import sys
from pathlib import Path

import anthropic
from pydantic import BaseModel, Field


class Cupom(BaseModel):
    estabelecimento: str
    cnpj: str | None
    data: str | None = Field(description="AAAA-MM-DD")
    itens: list[str] = Field(description="Uma linha por item, como aparece")
    total: float | None
    legibilidade: str = Field(description="boa, razoável ou ruim, considerando foco, ângulo e corte")
    observacoes: str = Field(description="O que não deu para ler com segurança")


caminho = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "dados" / "cupom.jpg"
tipo = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}[caminho.suffix.lower()]
dados = base64.standard_b64encode(caminho.read_bytes()).decode()

client = anthropic.Anthropic()
r = client.messages.parse(
    model="claude-opus-5-5",
    max_tokens=4000,
    messages=[
        {
            "role": "user",
            "content": [
                # A imagem vem antes do texto: costuma render melhor.
                {"type": "image", "source": {"type": "base64", "media_type": tipo, "data": dados}},
                {"type": "text", "text": "Extraia os dados deste cupom. Não invente o que estiver ilegível."},
            ],
        }
    ],
    output_config={"effort": "low"},
    output_format=Cupom,
)
cupom = r.parsed_output
print(cupom.model_dump_json(indent=2) if cupom else "Sem resultado")
# Imagens custam tokens de entrada proporcionais à resolução: reduza fotos enormes antes de enviar.
print(f"\n[{r.usage.input_tokens} tokens de entrada (a imagem é a maior parte) · {r.usage.output_tokens} de saída]")
