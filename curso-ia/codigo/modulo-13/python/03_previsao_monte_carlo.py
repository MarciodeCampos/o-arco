"""
Lab 13.4 — Quando fica pronto? Previsão por Monte Carlo a partir da vazão real (sem API).

Em vez de estimar cada tarefa em horas, usamos o histórico de quantos itens o time
conclui por semana e simulamos milhares de futuros possíveis. A resposta vem como
probabilidade ("85% de chance de terminar até X"), que é mais honesta que uma data só.

    python 03_previsao_monte_carlo.py
"""
import json
import random
from datetime import date, timedelta
from pathlib import Path

h = json.loads((Path(__file__).parent.parent / "dados" / "historico_time.json").read_text(encoding="utf-8"))
vazao, restantes, inicio = h["vazao_semanal"], h["itens_restantes"], date.fromisoformat(h["inicio"])
random.seed(13)
SIMULACOES = 10_000

semanas = []
for _ in range(SIMULACOES):
    feitos, n = 0, 0
    while feitos < restantes:
        feitos += random.choice(vazao)  # cada semana futura "sorteia" uma semana do passado
        n += 1
    semanas.append(n)
semanas.sort()

print(f"Vazão histórica: {vazao} (média {sum(vazao) / len(vazao):.1f} itens/semana)")
print(f"Itens restantes: {restantes} · início: {inicio:%d/%m/%Y}\n")
print(f"{'confiança':>10} {'semanas':>8} {'data':>12}")
for p in (0.50, 0.70, 0.85, 0.95):
    n = semanas[int(p * SIMULACOES) - 1]
    print(f"{p:>10.0%} {n:>8} {inicio + timedelta(weeks=n):%d/%m/%Y}")

media = restantes / (sum(vazao) / len(vazao))
print(f"\nA conta ingênua (restantes ÷ média) dá {media:.1f} semanas: é só a mediana, com ~50% de chance de atrasar.")
print("Comunique a data de 85% para compromissos externos e a de 50% como meta interna.")
print("Se o escopo crescer (itens novos no meio), refaça a simulação: ela é barata e deve ser semanal.")
