"""
Lab 3.6 — Quantos casos preciso? Simulando o ruído de um eval.

Imagine dois sistemas: A acerta 80% de verdade, B acerta 85% de verdade.
Se você rodar um eval com N casos, com que frequência ele vai dizer que B
é melhor? E com que frequência vai dizer o contrário?

Sem chamar API: é simulação pura.

    python 04_ruido_estatistico.py
"""
import numpy as np

rng = np.random.default_rng(42)
ACERTO_A, ACERTO_B = 0.80, 0.85
SIMULACOES = 5000


def wilson(k, n, z=1.96):
    p = k / n
    centro = (p + z * z / (2 * n)) / (1 + z * z / n)
    margem = z / (1 + z * z / n) * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return centro - margem, centro + margem


print("1) Largura do intervalo de confiança de 95% para uma taxa de 80%:\n")
for n in [10, 25, 50, 100, 200, 500, 1000]:
    lo, hi = wilson(int(0.8 * n), n)
    print(f"   {n:>5} casos → {lo:.0%} a {hi:.0%}   (±{(hi - lo) / 2 * 100:.0f} p.p.)")

print(f"\n2) A acerta {ACERTO_A:.0%}, B acerta {ACERTO_B:.0%} de verdade. Rodando o eval {SIMULACOES} vezes:\n")
print(f"   {'casos':>6} {'B parece melhor':>16} {'empate':>8} {'A parece melhor':>16} {'diferença detectada*':>21}")
for n in [10, 25, 50, 100, 200, 500, 1000]:
    a = rng.binomial(n, ACERTO_A, SIMULACOES)
    b = rng.binomial(n, ACERTO_B, SIMULACOES)
    # Pareado: cada caso tem uma "dificuldade"; aqui simplificamos como independentes.
    melhor_b = np.mean(b > a)
    empate = np.mean(b == a)
    melhor_a = np.mean(a > b)
    # "detectada": diferença maior que ~2 erros-padrão
    ep = np.sqrt(ACERTO_A * (1 - ACERTO_A) / n + ACERTO_B * (1 - ACERTO_B) / n)
    detectada = np.mean((b - a) / n > 1.96 * ep)
    print(f"   {n:>6} {melhor_b:>16.0%} {empate:>8.0%} {melhor_a:>16.0%} {detectada:>21.0%}")

print("\n   * B à frente por mais de 1,96 erros-padrão (o que um teste a 95% chamaria de diferença real).")

print("\n3) Repetições ajudam? Os MESMOS 50 casos, cada um rodado R vezes.")
print("   (mede só o ruído do não determinismo do modelo, não o de quais casos você escolheu)\n")
# Cada caso tem uma probabilidade própria de acerto; casos difíceis erram às vezes.
n_casos = 50
prob_casos = np.clip(rng.normal(0.8, 0.2, n_casos), 0.05, 1.0)
for reps in [1, 3, 5]:
    estimativas = []
    for _ in range(2000):
        acertos = rng.binomial(reps, prob_casos)
        estimativas.append(acertos.sum() / (n_casos * reps))
    print(f"   {n_casos} casos × {reps} rep. → variação da nota entre execuções: ±{np.std(estimativas) * 196:.1f} p.p. (95%)")

print(
    "\nConclusões:"
    "\n - Com 25 casos, uma melhora real de 5 p.p. quase nunca é detectada com confiança."
    "\n - Às vezes o sistema PIOR parece melhor. Um único eval pequeno pode enganar."
    "\n - Mais casos reduzem o ruído; repetições ajudam com o não determinismo, mas não"
    "\n   substituem casos novos (o ruído entre casos diferentes continua lá)."
)
