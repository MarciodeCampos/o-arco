"""
Lab 4.2 — BM25 do zero: a busca por palavras que ainda vence muita busca "com IA".

Indexa as seções da documentação da Brisa (projeto/docs) e responde consultas
com BM25, a fórmula clássica dos buscadores. Depois mostra onde ela falha:
quando a pergunta usa palavras diferentes das do documento.

    python 01_bm25_do_zero.py
    python 01_bm25_do_zero.py "como cancelo a assinatura"
"""
import math
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

DOCS = Path(__file__).parent.parent / "projeto" / "docs"
STOPWORDS = set("a o as os de da do das dos e em no na nos nas um uma uns umas por para com sem que se ao aos à às é ou como qual quais meu minha eu".split())


def tokens(texto: str) -> list[str]:
    t = unicodedata.normalize("NFKD", texto.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    palavras = re.findall(r"[a-z0-9]+", t)
    # "radicalização" bem simples: corta plurais e algumas terminações comuns
    return [re.sub(r"(oes|aes|s)$", "", p) for p in palavras if p not in STOPWORDS and len(p) > 1]


# ---------------------------------------------------------------- índice
secoes = []
for arq in sorted(DOCS.glob("*.md")):
    for bloco in re.split(r"\n(?=## )", arq.read_text(encoding="utf-8")):
        if bloco.startswith("## "):
            titulo = bloco.splitlines()[0][3:].strip()
            secoes.append((f"{arq.stem}#{titulo}", tokens(bloco)))

N = len(secoes)
tamanho_medio = sum(len(t) for _, t in secoes) / N
df = Counter(termo for _, toks in secoes for termo in set(toks))  # em quantas seções o termo aparece


def idf(termo: str) -> float:
    # termos raros pesam mais: "fidelidade" diz muito, "aparelho" quase nada
    return math.log(1 + (N - df[termo] + 0.5) / (df[termo] + 0.5))


def bm25(consulta: str, k1: float = 1.2, b: float = 0.75, top: int = 3):
    q = tokens(consulta)
    notas = []
    for nome, toks in secoes:
        tf = Counter(toks)
        nota = 0.0
        for termo in q:
            if tf[termo]:
                # saturação (k1): a 10ª repetição vale menos que a 1ª
                # normalização (b): seções longas não ganham só por serem longas
                nota += idf(termo) * tf[termo] * (k1 + 1) / (tf[termo] + k1 * (1 - b + b * len(toks) / tamanho_medio))
        notas.append((nota, nome))
    return sorted(notas, reverse=True)[:top], q


print(f"{N} seções indexadas, {len(df)} termos distintos, tamanho médio {tamanho_medio:.0f} termos\n")

consultas = sys.argv[1:] or [
    "frete grátis",
    "quanto custa a assinatura de filtros",
    "posso pausar o plano durante uma viagem",          # termos em comum: funciona
    "vou viajar dois meses, tenho que continuar pagando?",  # mesmo pedido, outras palavras
    "barulho no modo de dormir",                       # o documento diz "ruído" e "Sono"
]
for c in consultas:
    resultados, q = bm25(c)
    print(f'"{c}"  →  termos: {q}')
    for nota, nome in resultados:
        print(f"   {nota:5.2f}  {nome}" if nota else "   ----  (nenhuma seção com esses termos)")
    print()

print("Repare nas duas últimas: a resposta existe ('Pausar a assinatura', 'Modos de operação'),")
print("mas a pergunta usa palavras que o documento não usa. É esse buraco que embeddings tapam.")
