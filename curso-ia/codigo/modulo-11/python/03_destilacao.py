"""
Lab 11.6 — Destilação: um modelo grande ensina um pequeno, e uma cascata usa os dois.

Ideia: o modelo grande (professor) rotula muitos exemplos; um modelo minúsculo e
barato (aluno) aprende com esses rótulos. Em produção, o aluno responde quando está
confiante e passa para o professor quando não está (cascata).

Modos:
  python 03_destilacao.py                 # offline: usa os rótulos do dataset como se fossem
                                          #   do professor (para ver a mecânica sem gastar)
  python 03_destilacao.py --professor api # o claude-opus-5-5 rotula o treino de verdade

Rode antes o 01_preparar_dataset.py.
"""
import json
import math
import re
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np

PASTA = Path(__file__).parent.parent / "dados" / "preparado"
CATS = ["cobranca", "entrega", "defeito", "duvida"]


def carregar(nome):
    pares = []
    for l in (PASTA / f"{nome}.jsonl").read_text(encoding="utf-8").splitlines():
        m = json.loads(l)["messages"]
        pares.append((m[1]["content"], m[2]["content"]))
    return pares


treino, teste = carregar("treino"), carregar("teste")

# ---------------------------------------------------------------- 1. professor rotula o treino
if "--professor" in sys.argv and sys.argv[sys.argv.index("--professor") + 1] == "api":
    import anthropic

    client = anthropic.Anthropic()
    esquema = {"type": "json_schema", "schema": {"type": "object", "properties": {"categoria": {"type": "string", "enum": CATS}}, "required": ["categoria"], "additionalProperties": False}}
    rotulados = []
    for i, (texto, _) in enumerate(treino):
        r = client.messages.create(
            model="claude-opus-5-5", max_tokens=500,
            system="Classifique o chamado de suporte de uma loja: cobranca, entrega, defeito ou duvida.",
            messages=[{"role": "user", "content": texto}],
            output_config={"effort": "low", "format": esquema},
        )
        rotulados.append((texto, json.loads(r.content[0].text)["categoria"]))
        if (i + 1) % 25 == 0 or i + 1 == len(treino):
            print(f"  professor rotulou {i + 1}/{len(treino)}")
    origem = "claude-opus-5-5"
else:
    rotulados = treino
    origem = "rótulos do dataset (modo offline: no fluxo real, viriam do professor)"

# ---------------------------------------------------------------- 2. aluno: regressão logística sobre palavras
def tokens(t):
    return re.findall(r"[a-záéíóúâêôãõç]+", t.lower())


vocab = {w: i for i, w in enumerate(sorted({w for t, _ in rotulados for w in tokens(t)}))}


def vetor(t):
    v = np.zeros(len(vocab))
    for w in tokens(t):
        if w in vocab:
            v[vocab[w]] = 1
    return v


X = np.array([vetor(t) for t, _ in rotulados])
y = np.array([CATS.index(c) for _, c in rotulados])
W = np.zeros((len(vocab), len(CATS)))
for _ in range(300):
    z = X @ W
    p = np.exp(z - z.max(1, keepdims=True))
    p /= p.sum(1, keepdims=True)
    p[np.arange(len(y)), y] -= 1
    W -= 0.5 * (X.T @ p / len(y) + 1e-3 * W)


def aluno(t):
    z = vetor(t) @ W
    p = np.exp(z - z.max())
    p /= p.sum()
    return CATS[int(p.argmax())], float(p.max())


# ---------------------------------------------------------------- 3. avaliação e cascata
novos = [(d["texto"], d["categoria"]) for d in map(json.loads, (PASTA.parent / "chamados_novos.jsonl").read_text(encoding="utf-8").splitlines())]


def avaliar(nome, conjunto):
    prev = [aluno(t) for t, _ in conjunto]
    certos = sum(p == c for (p, _), (_, c) in zip(prev, conjunto))
    conf_media = sum(conf for _, conf in prev) / len(prev)
    print(f"  {nome:<44} {certos:>3}/{len(conjunto):<3} = {certos / len(conjunto):>4.0%}   confiança média {conf_media:.2f}")
    return prev


inicio = time.perf_counter()
_ = [aluno(t) for t, _ in teste]
ms = (time.perf_counter() - inicio) / len(teste) * 1000
print(f"Professor: {origem}")
print(f"Aluno: regressão logística · {W.size:,} parâmetros · {ms:.3f} ms por chamado · custo ~zero\n".replace(",", "."))
print("Acerto do aluno:")
avaliar("teste (mesma origem do treino)", teste)
prev_novos = avaliar("chamados novos (escritos de outro jeito)", novos)
print(
    "\nO aluno é ótimo no tipo de texto que viu e cai fora dele: aprendeu as palavras do treino,\n"
    "não o problema. Repare que a CONFIANÇA também cai: é isso que permite a cascata.\n"
)
print("CASCATA nos chamados novos: o aluno responde se estiver confiante; senão, o professor.")
print(f"  {'limiar':>7} {'vai p/ professor':>17} {'acerto*':>8}")
for limiar in [0.0, 0.5, 0.7, 0.9]:
    final = [(p if conf >= limiar else c) for (p, conf), (_, c) in zip(prev_novos, novos)]
    enviados = sum(conf < limiar for _, conf in prev_novos)
    print(f"  {limiar:>7.1f} {enviados / len(novos):>17.0%} {sum(f == c for f, (_, c) in zip(final, novos)) / len(novos):>8.0%}")
print("  * supondo que o professor acerta os casos que recebe (limite superior; meça o seu).")
print(
    "\nLições: (1) avalie o aluno em dados do MUNDO REAL, não só em dados parecidos com o treino;\n"
    "(2) a cascata troca custo por qualidade de forma controlada; escolha o limiar na validação;\n"
    "(3) os casos que vão para o professor são ótimos exemplos para o próximo treino do aluno."
)
