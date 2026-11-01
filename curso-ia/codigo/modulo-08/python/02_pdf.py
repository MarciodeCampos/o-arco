"""
Lab 8.3b — PDFs: perguntas sobre um contrato, com citações.

O PDF vai como bloco `document`; o modelo lê texto e também o layout das páginas.
Com citações ativadas, cada afirmação aponta o trecho e a página de origem.

    python 02_pdf.py
    python 02_pdf.py "Qual a multa por rescisão e como funciona a renovação?"
"""
import base64
import sys
from pathlib import Path

import anthropic

pdf = Path(__file__).parent.parent / "dados" / "contrato.pdf"
pergunta = " ".join(sys.argv[1:]) or "Quais são os riscos financeiros deste contrato para o contratante?"

client = anthropic.Anthropic()
r = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=4000,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {"type": "base64", "media_type": "application/pdf", "data": base64.standard_b64encode(pdf.read_bytes()).decode()},
                    "title": "Contrato de manutenção",
                    "citations": {"enabled": True},
                },
                {"type": "text", "text": f"{pergunta} Responda em português, em tópicos curtos."},
            ],
        }
    ],
    output_config={"effort": "low"},
)

for bloco in r.content:
    if bloco.type != "text":
        continue
    print(bloco.text, end="")
    for c in bloco.citations or []:
        if c.type == "page_location":
            print(f" [p. {c.start_page_number}: \"{c.cited_text.strip()[:60]}\"]", end="")
print(f"\n\n[{r.usage.input_tokens} tokens de entrada · {r.usage.output_tokens} de saída]")
