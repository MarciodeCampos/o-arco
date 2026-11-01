"""
Lab 2.2 — Um chat de terminal com histórico, esforço configurável e contagem de custo.

O ponto central: a API não guarda estado. Quem mantém a conversa é o seu código,
reenviando o histórico inteiro a cada mensagem.

    pip install -r requirements.txt
    export ANTHROPIC_API_KEY="..."
    python 01_chat_terminal.py
    ESFORCO=high python 01_chat_terminal.py

Comandos no chat:  /custo  /historico  /limpar  /sair
"""
import os
import sys

import anthropic

MODELO = os.environ.get("MODELO", "claude-opus-5-5")
ESFORCO = os.environ.get("ESFORCO", "low")  # low | medium | high | xhigh | max
PRECOS = {  # US$ por 1M tokens (entrada, saída), nov/2026
    "claude-opus-5-5": (4.00, 20.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-haiku-5-5": (0.10, 0.50),
}

SISTEMA = """Você é um mentor de engenharia de software.
Responda em português do Brasil, de forma direta. Use exemplos de código curtos quando ajudar.
Se não souber algo, diga que não sabe."""

client = anthropic.Anthropic()
historico: list[anthropic.types.beta.BetaMessageParam] = []
total_in = total_out = 0


def custo(t_in: int, t_out: int) -> float:
    p_in, p_out = PRECOS.get(MODELO, (0.0, 0.0))
    return t_in / 1e6 * p_in + t_out / 1e6 * p_out


print(f"Chat com {MODELO} (esforço {ESFORCO}). Digite /sair para terminar.\n")

while True:
    try:
        entrada = input("você › ").strip()
    except (EOFError, KeyboardInterrupt):
        break
    if not entrada:
        continue
    if entrada == "/sair":
        break
    if entrada == "/limpar":
        historico.clear()
        print("(histórico apagado: o modelo \"esqueceu\" a conversa)\n")
        continue
    if entrada == "/historico":
        for m in historico:
            texto = m["content"] if isinstance(m["content"], str) else "[blocos]"
            print(f"  {m['role']}: {str(texto)[:80]}")
        print()
        continue
    if entrada == "/custo":
        print(f"  entrada {total_in} · saída {total_out} · US$ {custo(total_in, total_out):.5f}\n")
        continue

    historico.append({"role": "user", "content": entrada})
    try:
        resposta = client.beta.messages.create(
            model=MODELO,
            max_tokens=8000,
            system=SISTEMA,
            messages=historico,
            output_config={"effort": ESFORCO},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.APIError as erro:
        historico.pop()  # não deixa uma mensagem sem resposta no histórico
        print(f"[erro] {erro}\n")
        continue

    if resposta.stop_reason == "refusal":
        historico.pop()
        print("[o modelo recusou essa mensagem]\n")
        continue

    # Guardamos os blocos completos da resposta (não só o texto): é o formato
    # recomendado, e preserva blocos de raciocínio entre turnos.
    historico.append({"role": "assistant", "content": resposta.content})
    texto = "".join(b.text for b in resposta.content if b.type == "text")
    print(f"\nmentor › {texto}\n")

    total_in += resposta.usage.input_tokens
    total_out += resposta.usage.output_tokens
    print(
        f"  [{resposta.usage.input_tokens} in / {resposta.usage.output_tokens} out"
        f" · conversa: US$ {custo(total_in, total_out):.5f}]\n"
    )

print(f"\nTotal: {total_in} tokens de entrada, {total_out} de saída, US$ {custo(total_in, total_out):.5f}")
sys.exit(0)
