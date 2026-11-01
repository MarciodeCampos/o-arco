"""
Lab 11.3 — Preparando um dataset de fine-tuning (sem API).

Da exportação bruta do sistema de atendimento (dados/chamados_brutos.jsonl)
até arquivos prontos para treinar um classificador de chamados:

  1. limpar (espaços, caixa alta, vazios, curtos demais, sem rótulo)
  2. MASCARAR dados pessoais (CPF, e-mail, telefone): o modelo não deve aprender
     nem poder repetir dados de clientes
  3. remover duplicatas (exatas e após normalização), ANTES de dividir
  4. dividir em treino/validação/teste estratificado por categoria
  5. escrever no formato de conversa (JSONL com "messages") usado por APIs de fine-tuning
  6. relatório: distribuição, tamanho, estimativa de tokens

    python 01_preparar_dataset.py
"""
import json
import random
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

DADOS = Path(__file__).parent.parent / "dados"
SAIDA = DADOS / "preparado"
SISTEMA = "Classifique o chamado de suporte em uma categoria: cobranca, entrega, defeito ou duvida. Responda só a categoria."
random.seed(42)

brutos = [json.loads(l) for l in (DADOS / "chamados_brutos.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
relatorio = Counter(lidos=len(brutos))

PII = [
    (re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"), "[CPF]"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "[EMAIL]"),
    (re.compile(r"\(?\d{2}\)?\s?9?\d{4}-?\d{4}"), "[TELEFONE]"),
]


def limpar(t: str) -> str:
    t = " ".join(t.split())
    if t.isupper():
        t = t.capitalize()  # caixa alta vira frase normal: o modelo não deve associar GRITO a categoria
    for padrao, marcador in PII:
        t, n = padrao.subn(marcador, t)
        relatorio[f"mascarado {marcador}"] += n
    return t


def chave(t: str) -> str:
    t = unicodedata.normalize("NFKD", t.lower())
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in t if not unicodedata.combining(c))).strip()


vistos, limpos = set(), []
for b in brutos:
    if not b.get("categoria"):
        relatorio["descartado: sem rótulo"] += 1
        continue
    texto = limpar(b.get("texto") or "")
    if len(texto) < 8:
        relatorio["descartado: vazio ou curto"] += 1
        continue
    k = chave(texto)
    if k in vistos:
        relatorio["descartado: duplicata"] += 1
        continue
    vistos.add(k)
    limpos.append({"id": b["id"], "texto": texto, "categoria": b["categoria"]})

# Divisão estratificada: cada categoria aparece nas mesmas proporções em treino, validação e teste.
por_cat = defaultdict(list)
for x in limpos:
    por_cat[x["categoria"]].append(x)
divisao = {"treino": [], "validacao": [], "teste": []}
for cat, itens in por_cat.items():
    random.shuffle(itens)
    n = len(itens)
    a, b = int(n * 0.7), int(n * 0.85)
    divisao["treino"] += itens[:a]
    divisao["validacao"] += itens[a:b]
    divisao["teste"] += itens[b:]

SAIDA.mkdir(exist_ok=True)
for nome, itens in divisao.items():
    random.shuffle(itens)
    with open(SAIDA / f"{nome}.jsonl", "w", encoding="utf-8") as f:
        for x in itens:
            f.write(json.dumps({"messages": [
                {"role": "system", "content": SISTEMA},
                {"role": "user", "content": x["texto"]},
                {"role": "assistant", "content": x["categoria"]},
            ]}, ensure_ascii=False) + "\n")

# Checagens finais: formato válido e nenhum vazamento entre os conjuntos.
textos = {nome: {chave(x["texto"]) for x in itens} for nome, itens in divisao.items()}
assert not (textos["treino"] & textos["teste"]), "vazamento: texto do teste também está no treino"
for nome in divisao:
    for linha in (SAIDA / f"{nome}.jsonl").read_text(encoding="utf-8").splitlines():
        msgs = json.loads(linha)["messages"]
        assert [m["role"] for m in msgs] == ["system", "user", "assistant"]

print("LIMPEZA")
for k, v in relatorio.items():
    print(f"  {k:<28} {v}")
print(f"  {'exemplos finais':<28} {len(limpos)}\n")
print("DIVISÃO (estratificada)")
for nome, itens in divisao.items():
    dist = Counter(x["categoria"] for x in itens)
    print(f"  {nome:<10} {len(itens):>4}  " + "  ".join(f"{c}={dist[c]}" for c in sorted(por_cat)))
tokens = sum(len(x["texto"]) + len(SISTEMA) for x in divisao["treino"]) / 4  # ~4 caracteres por token (estimativa grosseira)
print(f"\n~{tokens:,.0f} tokens de treino por época (estimativa)".replace(",", "."))
print(f"arquivos em {SAIDA.relative_to(DADOS.parent)}/")
print("\nRepare: 'duvida' tem poucos exemplos. Com tão pouco, o modelo ajustado tende a errar justamente essa classe.")
