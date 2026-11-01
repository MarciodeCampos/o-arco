"""
Lab 2.7a — Cache de prompt: pagar barato por contexto repetido.

Fazemos 3 perguntas sobre o mesmo manual. Na 1ª chamada o manual é gravado no
cache; nas seguintes ele é lido do cache a uma fração do preço.

    python 04_cache.py
"""
from pathlib import Path

import anthropic

MODELO = "claude-opus-5-5"
P_IN, P_OUT, P_CACHE_ESCRITA, P_CACHE_LEITURA = 4.00, 20.00, 5.00, 0.20  # US$/1M, nov/2026

manual = (Path(__file__).parent.parent / "dados" / "manual_produto.md").read_text(encoding="utf-8")

# Prefixo estável primeiro (instruções + documento), conteúdo variável (pergunta) depois.
# Qualquer byte diferente no prefixo invalida o cache: nada de data/hora no system prompt!
SISTEMA = [
    {"type": "text", "text": "Você responde dúvidas de clientes usando SOMENTE o manual abaixo. Responda em até 3 frases."},
    {"type": "text", "text": f"<manual>\n{manual}\n</manual>", "cache_control": {"type": "ephemeral"}},
]

perguntas = [
    "Como faço para resetar o equipamento?",
    "Qual a garantia?",
    "Posso usar em área externa?",
]

client = anthropic.Anthropic()
total_sem_cache = total_com_cache = 0.0

for i, pergunta in enumerate(perguntas, 1):
    r = client.messages.create(
        model=MODELO,
        max_tokens=2000,
        system=SISTEMA,
        messages=[{"role": "user", "content": pergunta}],
        output_config={"effort": "low"},
    )
    u = r.usage
    escrito = u.cache_creation_input_tokens or 0
    lido = u.cache_read_input_tokens or 0
    custo = (u.input_tokens * P_IN + escrito * P_CACHE_ESCRITA + lido * P_CACHE_LEITURA + u.output_tokens * P_OUT) / 1e6
    sem_cache = ((u.input_tokens + escrito + lido) * P_IN + u.output_tokens * P_OUT) / 1e6
    total_com_cache += custo
    total_sem_cache += sem_cache

    texto = "".join(b.text for b in r.content if b.type == "text")
    print(f"\n#{i} {pergunta}\n{texto}")
    print(f"   entrada normal {u.input_tokens} · gravado no cache {escrito} · lido do cache {lido} · saída {u.output_tokens}")

print(f"\nCusto com cache: US$ {total_com_cache:.5f}")
print(f"Custo sem cache: US$ {total_sem_cache:.5f}")
if total_sem_cache:
    print(f"Economia:        {1 - total_com_cache / total_sem_cache:.0%}")
print("\nSe 'lido do cache' ficar 0 nas chamadas 2 e 3, algo está mudando o prefixo entre as chamadas.")
