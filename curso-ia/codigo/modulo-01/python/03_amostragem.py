"""
Lab 1.6 — Como um LLM escolhe a próxima palavra.

O modelo não "escreve uma frase". Ele produz, a cada passo, uma pontuação
(logit) para cada token do vocabulário. A amostragem transforma isso em
uma escolha. Aqui simulamos esse passo para a frase:

    "O café da manhã hoje foi ___"

Rode:  python 03_amostragem.py
"""
import numpy as np

candidatos = ["pão", "tapioca", "café", "ovos", "fruta", "nada", "pizza"]
logits = np.array([3.0, 2.4, 2.2, 1.8, 1.5, 0.3, -1.0])  # saída fictícia do modelo


def softmax_com_temperatura(logits, temperatura):
    z = logits / temperatura
    z = z - z.max()
    p = np.exp(z)
    return p / p.sum()


def top_p(probs, p_limite):
    """Nucleus sampling: mantém só os tokens mais prováveis até somar p_limite."""
    ordem = np.argsort(probs)[::-1]
    acumulado = np.cumsum(probs[ordem])
    manter = ordem[: np.searchsorted(acumulado, p_limite) + 1]
    filtrado = np.zeros_like(probs)
    filtrado[manter] = probs[manter]
    return filtrado / filtrado.sum()


def barra(p):
    return "█" * int(p * 50)


for temp in [0.2, 1.0, 2.0]:
    probs = softmax_com_temperatura(logits, temp)
    print(f"\n=== temperatura {temp} ===")
    for c, p in sorted(zip(candidatos, probs), key=lambda x: -x[1]):
        print(f"{c:>8} {p:6.1%} {barra(p)}")

print("\n=== temperatura 1.0 + top_p 0.8 ===")
probs = top_p(softmax_com_temperatura(logits, 1.0), 0.8)
for c, p in sorted(zip(candidatos, probs), key=lambda x: -x[1]):
    if p > 0:
        print(f"{c:>8} {p:6.1%} {barra(p)}")

rng = np.random.default_rng(7)
print("\n10 sorteios com temperatura 1.0:")
probs = softmax_com_temperatura(logits, 1.0)
print(", ".join(rng.choice(candidatos, size=10, p=probs)))

print(
    "\nConclusão: temperatura baixa = previsível e repetitivo; alta = criativo e"
    "\narriscado. Por isso a mesma pergunta pode gerar respostas diferentes."
)
