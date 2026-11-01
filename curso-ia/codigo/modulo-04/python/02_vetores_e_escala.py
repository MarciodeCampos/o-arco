"""
Lab 4.1 — Vetores, similaridade e por que bancos vetoriais usam índices aproximados.

Parte 1: cosseno, produto interno e distância euclidiana com vetores pequenos.
Parte 2: busca exata (comparar com todos) em 10 mil, 100 mil e 1 milhão de vetores.

    python 02_vetores_e_escala.py
"""
import time

import numpy as np

np.set_printoptions(precision=3, suppress=True)
rng = np.random.default_rng(0)

# ---------------------------------------------------------------- parte 1
print("PARTE 1 — medidas de similaridade\n")
# Eixos imaginários: [entrega, garantia, preço, tecnologia]
vetores = {
    "prazo de entrega": np.array([0.9, 0.1, 0.2, 0.0]),
    "frete e transporte": np.array([0.8, 0.0, 0.4, 0.0]),
    "garantia do aparelho": np.array([0.1, 0.9, 0.1, 0.3]),
    "filtro HEPA H13": np.array([0.0, 0.2, 0.1, 0.9]),
}
consulta = np.array([0.7, 0.0, 0.3, 0.1])  # "quando chega meu pedido?"


def cosseno(a, b):
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))


print(f"{'documento':<22} {'cosseno':>8} {'produto':>8} {'euclid.':>8}")
for nome, v in vetores.items():
    print(f"{nome:<22} {cosseno(consulta, v):8.3f} {float(consulta @ v):8.3f} {np.linalg.norm(consulta - v):8.3f}")

print("\nRepare: pelo cosseno, 'frete e transporte' fica em 1º; pelo produto interno, 'prazo de entrega'.")
print("Sem normalizar, a medida escolhida muda o ranking.")
print("\nCom vetores NORMALIZADOS (tamanho 1), as três medidas ordenam igual:")
cn = consulta / np.linalg.norm(consulta)
for nome, v in vetores.items():
    vn = v / np.linalg.norm(v)
    print(f"  {nome:<22} cosseno {cosseno(cn, vn):.3f} = produto {float(cn @ vn):.3f}")
print("Por isso a maioria dos modelos de embedding já devolve vetores normalizados.\n")

# ---------------------------------------------------------------- parte 2
print("PARTE 2 — busca exata ('força bruta') conforme a base cresce\n")
DIM = 384
q = rng.normal(size=DIM).astype(np.float32)
q /= np.linalg.norm(q)
for n in [10_000, 100_000, 1_000_000]:
    base = rng.normal(size=(n, DIM)).astype(np.float32)
    base /= np.linalg.norm(base, axis=1, keepdims=True)
    inicio = time.perf_counter()
    for _ in range(5):
        notas = base @ q
        top = np.argpartition(-notas, 5)[:5]
    ms = (time.perf_counter() - inicio) / 5 * 1000
    mb = base.nbytes / 1e6
    print(f"  {n:>9,} vetores × {DIM} dim · {mb:7.0f} MB · {ms:7.1f} ms por consulta".replace(",", "."))
    del base

print(
    "\nA força bruta cresce linearmente com a base. Até dezenas de milhares de trechos ela"
    "\nresolve bem (e é exata!). Para milhões, índices aproximados como HNSW visitam só uma"
    "\nfração dos vetores e respondem em milissegundos, trocando um pouco de precisão por velocidade."
)
