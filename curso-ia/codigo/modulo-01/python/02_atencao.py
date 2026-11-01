"""
Lab 1.4 — Atenção (scaled dot-product attention) do zero.

A ideia central do Transformer: cada token "olha" para os outros tokens e
decide quanto de cada um ele quer misturar na sua própria representação.

    Atenção(Q, K, V) = softmax(Q · Kᵀ / √d) · V

Aqui usamos embeddings minúsculos (4 dimensões) escritos à mão, para você
conseguir ler os números. Em um LLM real são milhares de dimensões,
aprendidas no treino.

Rode:  python 02_atencao.py
"""
import numpy as np

np.set_printoptions(precision=2, suppress=True)

tokens = ["o", "gato", "subiu", "no", "telhado"]

# Embeddings de brinquedo: [animal, ação, lugar, palavra_funcional]
E = np.array([
    [0.0, 0.0, 0.0, 1.0],   # o
    [1.0, 0.2, 0.0, 0.0],   # gato
    [0.3, 1.0, 0.2, 0.0],   # subiu
    [0.0, 0.0, 0.3, 1.0],   # no
    [0.0, 0.1, 1.0, 0.0],   # telhado
])

d = E.shape[1]
rng = np.random.default_rng(0)

# Em um Transformer, Q, K e V são projeções aprendidas dos embeddings.
# Usamos a identidade + um pouco de ruído para manter a leitura intuitiva.
Wq = np.eye(d) + rng.normal(0, 0.05, (d, d))
Wk = np.eye(d) + rng.normal(0, 0.05, (d, d))
Wv = np.eye(d)

Q, K, V = E @ Wq, E @ Wk, E @ Wv


def softmax(x, eixo=-1):
    x = x - x.max(axis=eixo, keepdims=True)  # estabilidade numérica
    e = np.exp(x)
    return e / e.sum(axis=eixo, keepdims=True)


pontuacoes = Q @ K.T / np.sqrt(d)

# Máscara causal: num modelo que gera texto, um token só pode olhar para trás.
mascara = np.triu(np.ones((len(tokens), len(tokens))), k=1).astype(bool)
pontuacoes[mascara] = -np.inf

pesos = softmax(pontuacoes)
saida = pesos @ V

print("Pesos de atenção (linha = quem olha, coluna = para quem olha):\n")
print(" " * 9 + "".join(f"{t:>9}" for t in tokens))
for t, linha in zip(tokens, pesos):
    print(f"{t:>9}" + "".join(f"{p:9.2f}" for p in linha))

print("\nRepare: 'subiu' dá mais peso a 'gato' do que a 'o' (quem subiu?).")
print("Cada linha soma 1: é uma distribuição de probabilidade.\n")
print("Nova representação de 'telhado' (já misturada com o contexto):")
print(saida[-1])
