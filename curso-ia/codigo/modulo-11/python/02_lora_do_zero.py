"""
Lab 11.5 — LoRA do zero, em NumPy (sem GPU, sem bibliotecas de ML).

LoRA (Low-Rank Adaptation) congela os pesos originais W e treina só duas matrizes
pequenas, A (d×r) e B (r×k), somando o produto A·B ao peso:  W' = W + (α/r)·A·B.
Com r pequeno, treinamos uma fração mínima dos parâmetros.

O experimento:
  1. Pré-treina uma rede na tarefa A.
  2. Adapta para a tarefa B (relacionada, mas diferente) de três jeitos:
       - sem ajuste (só o modelo base)
       - ajuste COMPLETO (todos os pesos)
       - LoRA com postos r = 1, 2, 4, 8 (base congelada)
  3. Mede: acerto em B, fração de parâmetros treinados e quanto se ESQUECEU de A.

    python 02_lora_do_zero.py
"""
import numpy as np

rng = np.random.default_rng(0)
ENTRADA, OCULTA, CLASSES = 64, 256, 4

# ---------------------------------------------------------------- tarefas sintéticas
# Tarefa B = tarefa A + uma mudança de POSTO BAIXO: a hipótese central do LoRA é que
# a adaptação a uma tarefa nova muda os pesos numa direção de baixa dimensão.
Ta = rng.normal(size=(ENTRADA, CLASSES))
mudanca = rng.normal(size=(ENTRADA, 2)) @ rng.normal(size=(2, CLASSES))
Tb = Ta + 1.2 * mudanca


def dados(T, n):
    X = rng.normal(size=(n, ENTRADA))
    return X, np.argmax(X @ T + 0.3 * rng.normal(size=(n, CLASSES)), axis=1)


Xa, ya = dados(Ta, 4000)
Xa_teste, ya_teste = dados(Ta, 2000)
Xb, yb = dados(Tb, 600)  # pouco dado para a tarefa nova, como é comum em fine-tuning
Xb_teste, yb_teste = dados(Tb, 2000)


# ---------------------------------------------------------------- rede e treino
def softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def forward(p, X, lora=None):
    W1 = p["W1"] + (lora["escala"] * lora["A"] @ lora["B"] if lora else 0)
    h = np.maximum(0, X @ W1 + p["b1"])
    return h, softmax(h @ p["W2"] + p["b2"]), W1


def acerto(p, X, y, lora=None):
    return (forward(p, X, lora)[1].argmax(1) == y).mean()


def treinar(p, X, y, epocas, taxa, lora=None, treinar_base=True):
    for _ in range(epocas):
        for i in range(0, len(X), 64):
            xb, yb_ = X[i : i + 64], y[i : i + 64]
            h, prob, W1 = forward(p, xb, lora)
            d = prob.copy()
            d[np.arange(len(yb_)), yb_] -= 1
            d /= len(yb_)
            dW2, db2 = h.T @ d, d.sum(0)
            dh = (d @ p["W2"].T) * (h > 0)
            dW1, db1 = xb.T @ dh, dh.sum(0)
            if treinar_base:
                p["W2"] -= taxa * dW2
                p["b2"] -= taxa * db2
                p["W1"] -= taxa * dW1
                p["b1"] -= taxa * db1
            if lora:
                # Regra da cadeia: dL/dA = escala · dW1 · Bᵀ ; dL/dB = escala · Aᵀ · dW1
                gA = lora["escala"] * dW1 @ lora["B"].T
                gB = lora["escala"] * lora["A"].T @ dW1
                lora["A"] -= taxa * gA
                lora["B"] -= taxa * gB
    return p


base = {
    "W1": rng.normal(0, np.sqrt(2 / ENTRADA), (ENTRADA, OCULTA)),
    "b1": np.zeros(OCULTA),
    "W2": rng.normal(0, np.sqrt(2 / OCULTA), (OCULTA, CLASSES)),
    "b2": np.zeros(CLASSES),
}
treinar(base, Xa, ya, epocas=30, taxa=0.05)
total = sum(v.size for v in base.values())
copia = lambda p: {k: v.copy() for k, v in p.items()}

print(f"Modelo base: {total:,} parâmetros · acerto na tarefa A: {acerto(base, Xa_teste, ya_teste):.1%}\n".replace(",", "."))
print(f"{'abordagem':<26} {'treinados':>10} {'% do total':>10} {'acerto B':>9} {'acerto A depois':>16}")


def linha(nome, treinados, acB, acA):
    print(f"{nome:<26} {treinados:>10,} {treinados / total:>10.1%} {acB:>9.1%} {acA:>16.1%}".replace(",", "."))


linha("sem ajuste (base)", 0, acerto(base, Xb_teste, yb_teste), acerto(base, Xa_teste, ya_teste))

completo = treinar(copia(base), Xb, yb, epocas=40, taxa=0.05)
linha("ajuste completo", total, acerto(completo, Xb_teste, yb_teste), acerto(completo, Xa_teste, ya_teste))

for r in [1, 2, 4, 8]:
    p = copia(base)
    # Inicialização do artigo: A aleatória, B = 0 → no início W' = W (o adaptador começa "desligado").
    lora = {"A": rng.normal(0, 0.1, (ENTRADA, r)), "B": np.zeros((r, OCULTA)), "escala": 4.0 / r}
    treinar(p, Xb, yb, epocas=40, taxa=0.05, lora=lora, treinar_base=False)
    treinados = lora["A"].size + lora["B"].size
    # Sem o adaptador, a base está intacta: zero esquecimento da tarefa A.
    linha(f"LoRA r={r} (só em W1)", treinados, acerto(p, Xb_teste, yb_teste, lora), acerto(p, Xa_teste, ya_teste))

print(
    "\nLeitura:\n"
    " - LoRA treina uma fração pequena dos parâmetros e chega perto (ou passa) do ajuste completo\n"
    "   quando a mudança necessária é de posto baixo, como aqui.\n"
    " - O ajuste completo ESQUECE a tarefa A (esquecimento catastrófico). Com LoRA a base fica\n"
    "   intacta: tire o adaptador e a tarefa A volta. Dá para ter vários adaptadores sobre a mesma base.\n"
    " - Repare qual posto foi melhor: a mudança entre as tarefas foi criada com posto 2. Quando r\n"
    "   acompanha a dimensão real da adaptação, o resultado é o melhor; acima disso, só custa mais.\n"
    "   Na prática você não conhece essa dimensão: r é um hiperparâmetro a medir.\n"
    " - QLoRA é a mesma ideia com a base quantizada (4 bits), para caber em GPUs menores."
)
