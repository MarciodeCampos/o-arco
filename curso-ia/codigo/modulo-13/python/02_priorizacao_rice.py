"""
Lab 13.2 — Priorização RICE e o que realmente decide a ordem (sem API).

RICE = (Alcance × Impacto × Confiança) / Esforço. A IA pode ajudar a estimar os
números (a partir de dados de uso, chamados, pesquisas), mas a pergunta que importa
é: quanto a ORDEM muda se uma estimativa estiver errada? Este lab faz essa análise.

    python 02_priorizacao_rice.py
"""
import csv
import random
from pathlib import Path

itens = list(csv.DictReader((Path(__file__).parent.parent / "dados" / "backlog.csv").open(encoding="utf-8")))
for i in itens:
    for k in ("alcance_mes", "impacto", "confianca", "esforco_semanas"):
        i[k] = float(i[k])


def rice(i, fator=None):
    f = fator or {}
    return (i["alcance_mes"] * f.get("alcance", 1) * i["impacto"] * i["confianca"]) / (i["esforco_semanas"] * f.get("esforco", 1))


ranking = sorted(itens, key=rice, reverse=True)
print(f"{'#':<3} {'item':<44} {'RICE':>8}")
for n, i in enumerate(ranking, 1):
    print(f"{n:<3} {i['item']:<44} {rice(i):>8.0f}")

# Sensibilidade: cada estimativa pode estar errada em até ±50%. Quão estável é o topo?
random.seed(1)
SIMULACOES = 5000
topo = {i["id"]: 0 for i in itens}
posicoes = {i["id"]: [] for i in itens}
for _ in range(SIMULACOES):
    ruido = {i["id"]: {"alcance": random.uniform(0.5, 1.5), "esforco": random.uniform(0.5, 1.5)} for i in itens}
    ordem = sorted(itens, key=lambda i: rice(i, ruido[i["id"]]), reverse=True)
    topo[ordem[0]["id"]] += 1
    for pos, i in enumerate(ordem, 1):
        posicoes[i["id"]].append(pos)

print(f"\nSe alcance e esforço puderem errar ±50% ({SIMULACOES} simulações):")
print(f"{'item':<44} {'chance de ser o 1º':>18} {'posição típica':>15}")
for i in ranking:
    ps = sorted(posicoes[i["id"]])
    print(f"{i['item']:<44} {topo[i['id']] / SIMULACOES:>18.0%} {ps[len(ps) // 10]:>7}–{ps[9 * len(ps) // 10]:<7}")

print(
    "\nLeitura: itens com faixa de posição estreita estão bem decididos; faixas largas pedem\n"
    "estimativas melhores ANTES de discutir a ordem. É aí que dados (e IA analisando chamados,\n"
    "uso e pesquisas) valem mais: reduzir a incerteza das estimativas que mudam a decisão."
)
