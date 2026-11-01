"""
Projeto do Módulo 1 — Um modelo de linguagem do zero (caracteres, bigramas).

É a versão mais simples possível do que um LLM faz: dado o caractere atual,
prever o próximo. Fazemos de dois jeitos e comparamos:

  Parte A — contando: quantas vezes "b" vem depois de "a"?  (estatística pura)
  Parte B — aprendendo: uma rede neural de uma camada, treinada com gradiente
            descendente, que chega no mesmo resultado sozinha.

Depois geramos texto novo, amostrando com temperatura.

Rode:  python projeto_modelo_de_linguagem.py
       python projeto_modelo_de_linguagem.py --temperatura 0.5

Inspirado na série "Neural Networks: Zero to Hero", de Andrej Karpathy.
"""
import argparse
from pathlib import Path

import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("--corpus", default=str(Path(__file__).parent.parent / "dados" / "corpus.txt"))
parser.add_argument("--temperatura", type=float, default=0.8)
parser.add_argument("--epocas", type=int, default=300)
args = parser.parse_args()

# ------------------------------------------------------------------ dados
texto = Path(args.corpus).read_text(encoding="utf-8").lower()
linhas = [l.strip() for l in texto.splitlines() if l.strip()]

# Vocabulário: cada caractere vira um número (é a nossa "tokenização").
# "|" marca início e fim de frase.
vocab = sorted(set("".join(linhas)) | {"|"})
stoi = {c: i for i, c in enumerate(vocab)}
itos = {i: c for c, i in stoi.items()}
V = len(vocab)
print(f"{len(linhas)} frases, vocabulário de {V} caracteres\n")

# Pares (atual -> próximo). Separamos 10% das frases para validação.
rng = np.random.default_rng(1337)
ordem = rng.permutation(len(linhas))
corte = int(len(linhas) * 0.9)
treino_linhas = [linhas[i] for i in ordem[:corte]]
valid_linhas = [linhas[i] for i in ordem[corte:]]


def pares(frases):
    xs, ys = [], []
    for f in frases:
        seq = "|" + f + "|"
        for a, b in zip(seq, seq[1:]):
            xs.append(stoi[a])
            ys.append(stoi[b])
    return np.array(xs), np.array(ys)


Xtr, Ytr = pares(treino_linhas)
Xva, Yva = pares(valid_linhas)


def nll(probs, xs, ys):
    """Perda: log-verossimilhança negativa média. Menor = modelo menos surpreso."""
    return -np.mean(np.log(probs[xs, ys] + 1e-12))


# ------------------------------------------------------------------ Parte A: contagem
contagens = np.ones((V, V))  # começa em 1 (suavização): nada tem probabilidade zero
np.add.at(contagens, (Xtr, Ytr), 1)
P_contagem = contagens / contagens.sum(axis=1, keepdims=True)

print("Parte A — modelo por contagem")
print(f"  perda treino {nll(P_contagem, Xtr, Ytr):.3f} | validação {nll(P_contagem, Xva, Yva):.3f}")
print(f"  (um chute uniforme teria perda {np.log(V):.3f})\n")


# ------------------------------------------------------------------ Parte B: rede neural
# Entrada one-hot (V) -> pesos W (V x V) -> logits -> softmax -> probabilidades.
W = rng.normal(0, 0.01, (V, V))
TAXA = 50.0  # alta porque o gradiente médio por peso é minúsculo


def softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


print("Parte B — rede neural treinando")
for epoca in range(args.epocas + 1):
    # Multiplicar one-hot por W é o mesmo que pegar a linha W[x]: um "embedding".
    logits = W[Xtr]
    probs = softmax(logits)
    perda = -np.mean(np.log(probs[np.arange(len(Ytr)), Ytr]))

    grad = probs.copy()
    grad[np.arange(len(Ytr)), Ytr] -= 1
    grad /= len(Ytr)
    dW = np.zeros_like(W)
    np.add.at(dW, Xtr, grad)
    W -= TAXA * dW

    if epoca % 50 == 0:
        p_va = softmax(W)
        print(f"  época {epoca:4d}  perda treino {perda:.3f} | validação {nll(p_va, Xva, Yva):.3f}")

P_rede = softmax(W)
print("\nA rede aprendeu sozinha o que a Parte A fez contando. Ninguém mandou contar.")
print("Agora observe a perda de VALIDAÇÃO: ela cai e depois volta a subir, enquanto a")
print("de treino continua caindo. Isso é overfitting: com um corpus pequeno, a rede")
print("começa a decorar as frases de treino em vez de aprender português.")
print("A Parte A não sofre tanto porque a suavização (+1) funciona como regularização.\n")


# ------------------------------------------------------------------ geração
def gerar(P, temperatura, n=5, max_len=120):
    frases = []
    for _ in range(n):
        atual, saida = stoi["|"], []
        for _ in range(max_len):
            logp = np.log(P[atual] + 1e-12) / temperatura
            p = np.exp(logp - logp.max())
            p /= p.sum()
            atual = rng.choice(V, p=p)
            if itos[atual] == "|":
                break
            saida.append(itos[atual])
        frases.append("".join(saida))
    return frases


print(f"Texto gerado pela rede (temperatura {args.temperatura}):")
for f in gerar(P_rede, args.temperatura):
    print("  •", f)

print(
    "\nParece português? Quase. O modelo só enxerga 1 caractere para trás."
    "\nDesafios: (1) use os 2 últimos caracteres (trigramas); (2) troque o corpus;"
    "\n(3) compare temperaturas 0.3, 0.8 e 1.5."
)
