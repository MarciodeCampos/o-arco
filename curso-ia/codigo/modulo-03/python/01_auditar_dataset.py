"""
Lab 3.2 — Auditando um dataset de avaliação ANTES de confiar nele.

O arquivo dados/dataset_suporte.jsonl tem problemas plantados de propósito.
Este script encontra os que dá para achar com código. Os outros (rótulo
discutível) só uma leitura humana encontra.

    python 01_auditar_dataset.py
    python 01_auditar_dataset.py caminho/para/seu_dataset.jsonl
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

arquivo = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "dados" / "dataset_suporte.jsonl"
casos = [json.loads(l) for l in arquivo.read_text(encoding="utf-8").splitlines() if l.strip()]
print(f"{len(casos)} casos em {arquivo.name}\n")


def normalizar(t: str) -> str:
    t = unicodedata.normalize("NFKD", t.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


problemas = 0

# 1. Campos vazios
for c in casos:
    vazios = [k for k in ("texto", "categoria") if not str(c.get(k, "")).strip()]
    if vazios:
        problemas += 1
        print(f"[campo vazio]      {c['id']}: {', '.join(vazios)}")

# 2. Duplicatas exatas e quase-duplicatas
por_texto = defaultdict(list)
por_normalizado = defaultdict(list)
for c in casos:
    if c["texto"].strip():
        por_texto[c["texto"]].append(c["id"])
        por_normalizado[normalizar(c["texto"])].append(c["id"])
for ids in por_texto.values():
    if len(ids) > 1:
        problemas += 1
        print(f"[duplicata exata]  {', '.join(ids)}")
for ids in por_normalizado.values():
    exatos = {tuple(v) for v in por_texto.values()}
    if len(ids) > 1 and tuple(ids) not in exatos:
        problemas += 1
        print(f"[quase duplicata]  {', '.join(ids)}")

# 3. Vazamento do rótulo no texto
for c in casos:
    if c["categoria"] and re.search(rf"\b{re.escape(c['categoria'])}\b", normalizar(c["texto"])):
        problemas += 1
        print(f"[vazamento]        {c['id']}: o texto contém o próprio rótulo '{c['categoria']}'")

# 4. Balanceamento e linha de base
rotulados = [c["categoria"] for c in casos if c["categoria"]]
dist = Counter(rotulados)
maioria, n_maioria = dist.most_common(1)[0]
print("\nDistribuição dos rótulos:")
for cat, n in dist.most_common():
    print(f"  {cat:<14} {n:>3}  {'█' * n}")
print(
    f"\nLinha de base da classe majoritária: responder sempre '{maioria}' acerta "
    f"{n_maioria / len(rotulados):.0%}. Seu sistema precisa superar isso com folga."
)
if n_maioria / len(rotulados) > 0.5:
    problemas += 1
    print("[desbalanceado]    mais da metade dos casos é de uma única classe")

# 5. Tamanho dos textos
tamanhos = sorted(len(c["texto"]) for c in casos if c["texto"])
print(f"\nTamanho dos textos (caracteres): mín {tamanhos[0]} · mediana {tamanhos[len(tamanhos) // 2]} · máx {tamanhos[-1]}")

print(f"\n{problemas} problemas encontrados automaticamente.")
print("Agora leia alguns casos você mesmo: há pelo menos um rótulo discutível que nenhum script pega.")
