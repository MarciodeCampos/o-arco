"""
Lab 2.7b — Batch: processar muitas requisições pela metade do preço.

Quando ninguém está esperando a resposta na hora (classificar avaliações da
noite, gerar descrições de produto, rodar evals), o processamento em lote
custa 50% menos. A troca: o resultado chega em minutos ou horas, não segundos.

    python 05_batch.py            # envia o lote e acompanha até terminar
    python 05_batch.py msgbatch_x # retoma um lote já enviado
"""
import json
import sys
import time
from pathlib import Path

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

MODELO = "claude-opus-5-5"

avaliacoes = [
    json.loads(l)
    for l in (Path(__file__).parent.parent / "dados" / "avaliacoes.jsonl").read_text(encoding="utf-8").splitlines()
    if l.strip()
]

ESQUEMA = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {
            "sentimento": {"type": "string", "enum": ["positivo", "neutro", "negativo"]},
            "tema": {"type": "string", "enum": ["entrega", "qualidade", "preco", "atendimento", "outro"]},
        },
        "required": ["sentimento", "tema"],
        "additionalProperties": False,
    },
}

client = anthropic.Anthropic()

if len(sys.argv) > 1:
    lote_id = sys.argv[1]
else:
    lote = client.messages.batches.create(
        requests=[
            Request(
                custom_id=a["id"],  # é por ele que você casa o resultado com a entrada
                params=MessageCreateParamsNonStreaming(
                    model=MODELO,
                    max_tokens=1000,
                    system="Classifique a avaliação de cliente de uma loja online.",
                    messages=[{"role": "user", "content": a["texto"]}],
                    output_config={"effort": "low", "format": ESQUEMA},
                ),
            )
            for a in avaliacoes
        ]
    )
    lote_id = lote.id
    print(f"Lote enviado: {lote_id} ({len(avaliacoes)} requisições)")

while True:
    lote = client.messages.batches.retrieve(lote_id)
    if lote.processing_status == "ended":
        break
    print(f"  status: {lote.processing_status} · processando: {lote.request_counts.processing}")
    time.sleep(30)

textos = {a["id"]: a["texto"] for a in avaliacoes}
contagem: dict[str, int] = {}
# Os resultados chegam em QUALQUER ordem: use sempre o custom_id.
for item in client.messages.batches.results(lote_id):
    if item.result.type != "succeeded":
        print(f"[{item.custom_id}] {item.result.type}")
        continue
    msg = item.result.message
    dados = json.loads(next(b.text for b in msg.content if b.type == "text"))
    contagem[dados["sentimento"]] = contagem.get(dados["sentimento"], 0) + 1
    print(f"[{item.custom_id}] {dados['sentimento']:>8} · {dados['tema']:<11} · {textos.get(item.custom_id, '')[:60]}")

print(f"\nResumo: {contagem}")
