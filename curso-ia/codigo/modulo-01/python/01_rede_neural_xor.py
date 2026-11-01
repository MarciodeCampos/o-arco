"""
Lab 1.3 — Sua primeira rede neural, do zero, só com NumPy.

Problema: aprender a função XOR, que uma única "reta" (um neurônio sozinho)
não consegue separar. Com uma camada escondida, a rede aprende.

Ciclo completo: dados -> treino -> validação -> inferência.

Rode:  python 01_rede_neural_xor.py
"""
import numpy as np

rng = np.random.default_rng(seed=42)

# ---------------------------------------------------------------- 1. DADOS
# Cada linha é um exemplo: [entrada_a, entrada_b]  ->  saída esperada
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)  # tensor 4x2
y = np.array([[0], [1], [1], [0]], dtype=float)              # tensor 4x1

# ---------------------------------------------------------------- 2. MODELO
# Rede 2 -> 4 -> 1. Os "pesos" são só matrizes (tensores) de números.
ESCONDIDA = 4
W1 = rng.normal(0, 1, size=(2, ESCONDIDA))
b1 = np.zeros((1, ESCONDIDA))
W2 = rng.normal(0, 1, size=(ESCONDIDA, 1))
b2 = np.zeros((1, 1))


def sigmoide(z):
    return 1 / (1 + np.exp(-z))


def forward(X):
    """Passagem para frente: entrada -> previsão."""
    h = np.tanh(X @ W1 + b1)        # camada escondida
    saida = sigmoide(h @ W2 + b2)   # probabilidade entre 0 e 1
    return h, saida


def perda(previsto, real):
    """Entropia cruzada binária: quanto a rede está errando."""
    eps = 1e-9
    return -np.mean(real * np.log(previsto + eps) + (1 - real) * np.log(1 - previsto + eps))


# ---------------------------------------------------------------- 3. TREINO
TAXA_APRENDIZADO = 0.5
EPOCAS = 5000

for epoca in range(EPOCAS + 1):
    h, previsto = forward(X)
    L = perda(previsto, y)

    # Backpropagation: regra da cadeia, da saída para a entrada.
    d_saida = (previsto - y) / len(X)          # dL/dz2 (sigmoide + entropia cruzada)
    dW2 = h.T @ d_saida
    db2 = d_saida.sum(axis=0, keepdims=True)
    d_h = (d_saida @ W2.T) * (1 - h ** 2)      # derivada da tanh
    dW1 = X.T @ d_h
    db1 = d_h.sum(axis=0, keepdims=True)

    # Gradiente descendente: dá um passinho contra o gradiente.
    W2 -= TAXA_APRENDIZADO * dW2
    b2 -= TAXA_APRENDIZADO * db2
    W1 -= TAXA_APRENDIZADO * dW1
    b1 -= TAXA_APRENDIZADO * db1

    if epoca % 1000 == 0:
        print(f"época {epoca:5d}  perda {L:.4f}")

# ---------------------------------------------------------------- 4. VALIDAÇÃO
# Em XOR não há dados "novos", então validamos nos 4 casos possíveis.
# Em problemas reais você SEMPRE separa um conjunto que a rede nunca viu.
_, previsto = forward(X)
acertos = ((previsto > 0.5) == y).mean()
print(f"\nacurácia: {acertos:.0%}")

# ---------------------------------------------------------------- 5. INFERÊNCIA
for a, b in X.astype(int):
    _, p = forward(np.array([[a, b]], dtype=float))
    print(f"{a} XOR {b} = {p[0, 0]:.3f}  ->  {int(p[0, 0] > 0.5)}")
