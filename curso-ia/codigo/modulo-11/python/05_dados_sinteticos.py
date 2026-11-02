"""
Lab 11.8 — Dados sintéticos: gerar, filtrar e provar que ajudam (sem contaminar a avaliação).

O aluno do Lab 11.6 acerta tudo no teste e cai nos chamados escritos de outro jeito: aprendeu as
palavras do treino, não o problema. Exemplos sintéticos variados podem ajudar, mas só depois de
passar por filtros. O pipeline:

  1. gerar     um modelo grande escreve chamados variando categoria, tom e canal
  2. limpar    remove duplicatas e quase duplicatas
  3. novidade  remove cópias do treino (não acrescentam nada)
  4. contaminação  remove o que se parece com o teste ou com os chamados novos (senão a nota mente)
  5. rótulos   marca para revisão exemplos cujo rótulo o aluno atual contesta com muita confiança
               (com --api, um juiz confere cada exemplo)
  6. medir     diversidade e efeito no aluno, nos dois conjuntos de avaliação

    python 05_dados_sinteticos.py         # usa dados/sinteticos_exemplo.jsonl (sem API)
    python 05_dados_sinteticos.py --api   # o claude-opus-5-5 gera e julga (precisa de ANTHROPIC_API_KEY)

Rode antes o 01_preparar_dataset.py.
"""
import json
import random
import re
import sys
from collections import Counter
from itertools import product
from pathlib import Path

import numpy as np

DADOS = Path(__file__).parent.parent / "dados"
CATS = ["cobranca", "entrega", "defeito", "duvida"]
TONS = ["irritado", "educado", "confuso"]
CANAIS = ["chat", "email", "whatsapp"]
LIMIAR_DUPLICATA = 0.6
LIMIAR_CONTAMINACAO = 0.5


# ------------------------------------------------------------------ dados reais
def carregar(nome):
    pares = []
    for l in (DADOS / "preparado" / f"{nome}.jsonl").read_text(encoding="utf-8").splitlines():
        m = json.loads(l)["messages"]
        pares.append((m[1]["content"], m[2]["content"]))
    return pares


# ------------------------------------------------------------------ similaridade
def palavras(t: str) -> list[str]:
    t = re.sub(r"\[[A-Z]+\]", " ", t.lower())         # [CPF], [EMAIL] mascarados
    t = re.sub(r"\d+([.,]\d+)*", " <n> ", t)           # números viram um marcador: moldes iguais se reconhecem
    return re.findall(r"<n>|[a-záéíóúâêôãõçà]+", t)


def shingles(t: str, k: int = 3) -> set:
    p = palavras(t)
    return {tuple(p[i:i + k]) for i in range(max(1, len(p) - k + 1))}


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a | b else 0.0


def mais_parecido(t: str, referencia: list[tuple[str, set]]) -> tuple[float, str]:
    s = shingles(t)
    return max(((jaccard(s, rs), rt) for rt, rs in referencia), default=(0.0, ""))


# ------------------------------------------------------------------ aluno (o mesmo do Lab 11.6)
def tokens(t):
    return re.findall(r"[a-záéíóúâêôãõç]+", t.lower())


def treinar(exemplos):
    vocab = {w: i for i, w in enumerate(sorted({w for t, _ in exemplos for w in tokens(t)}))}

    def vetor(t):
        v = np.zeros(len(vocab))
        for w in tokens(t):
            if w in vocab:
                v[vocab[w]] = 1
        return v

    X = np.array([vetor(t) for t, _ in exemplos])
    y = np.array([CATS.index(c) for _, c in exemplos])
    W = np.zeros((len(vocab), len(CATS)))
    for _ in range(300):
        z = X @ W
        p = np.exp(z - z.max(1, keepdims=True))
        p /= p.sum(1, keepdims=True)
        p[np.arange(len(y)), y] -= 1
        W -= 0.5 * (X.T @ p / len(y) + 1e-3 * W)

    def prever(t):
        z = vetor(t) @ W
        p = np.exp(z - z.max())
        p /= p.sum()
        return CATS[int(p.argmax())], float(p.max())

    return prever


def acerto(prever, conjunto):
    return sum(prever(t)[0] == c for t, c in conjunto) / len(conjunto)


# ------------------------------------------------------------------ geração
def gerar_com_api(treino):
    import anthropic
    from pydantic import BaseModel, Field

    class Lote(BaseModel):
        chamados: list[str] = Field(description="Chamados distintos, cada um como o cliente escreveria")

    client = anthropic.Anthropic()
    rnd = random.Random(0)
    gerados = []
    combos = list(product(CATS, TONS, CANAIS))
    for i, (cat, tom, canal) in enumerate(combos):
        sementes = rnd.sample([t for t, c in treino if c == cat], 3)
        r = client.messages.parse(
            model="claude-opus-5-5",
            max_tokens=4000,
            system=(
                "Você escreve chamados de suporte realistas de clientes de uma loja que vende purificadores de água, "
                "para treinar um classificador. Categorias: cobranca (pagamentos, faturas, reembolsos), entrega "
                "(prazos, endereço, rastreio, transporte), defeito (produto com problema ou faltando peça), duvida "
                "(como usar, instalar, garantia, compatibilidade)."
            ),
            messages=[{"role": "user", "content": (
                f"Escreva 4 chamados da categoria '{cat}', com tom {tom}, como mensagens de {canal}. "
                "Varie o assunto, o tamanho e o vocabulário; inclua erros de digitação se combinar com o canal. "
                "Os exemplos abaixo mostram o tema, mas NÃO os copie nem os parafraseie de perto:\n"
                + "\n".join(f"- {s}" for s in sementes)
            )}],
            output_config={"effort": "low"},
            output_format=Lote,
        )
        if r.stop_reason == "refusal" or r.parsed_output is None:
            continue
        gerados += [{"texto": t, "categoria": cat, "tom": tom, "canal": canal} for t in r.parsed_output.chamados]
        print(f"  gerado {i + 1}/{len(combos)}", end="\r")
    print()
    return gerados


def julgar_com_api(exemplos):
    import anthropic
    from pydantic import BaseModel
    from typing import Literal

    class Veredito(BaseModel):
        realista: bool
        categoria_correta: Literal["cobranca", "entrega", "defeito", "duvida"]

    client = anthropic.Anthropic()
    aprovados, reprovados = [], []
    for e in exemplos:
        r = client.messages.parse(
            model="claude-opus-5-5", max_tokens=1000,
            system="Você revisa dados de treino. Diga se o chamado é realista e qual a categoria correta: cobranca, entrega, defeito ou duvida.",
            messages=[{"role": "user", "content": e["texto"]}],
            output_config={"effort": "low"}, output_format=Veredito,
        )
        v = r.parsed_output
        ok = v is not None and v.realista and v.categoria_correta == e["categoria"]
        (aprovados if ok else reprovados).append(e)
    return aprovados, reprovados


# ------------------------------------------------------------------ pipeline
def pipeline(candidatos, treino, avaliacao):
    relatorio = Counter()
    descartes = []

    # 2. duplicatas dentro do próprio lote
    mantidos, vistos = [], []
    for e in candidatos:
        sim, _ = mais_parecido(e["texto"], vistos)
        if sim >= LIMIAR_DUPLICATA:
            relatorio["duplicata"] += 1
            descartes.append((e, "duplicata", sim))
            continue
        mantidos.append(e)
        vistos.append((e["texto"], shingles(e["texto"])))

    # 3. cópias do treino
    ref_treino = [(t, shingles(t)) for t, _ in treino]
    novos = []
    for e in mantidos:
        sim, parecido = mais_parecido(e["texto"], ref_treino)
        if sim >= LIMIAR_DUPLICATA:
            relatorio["cópia do treino"] += 1
            descartes.append((e, f"cópia do treino ({parecido[:40]}…)", sim))
        else:
            novos.append(e)

    # 4. contaminação da avaliação
    ref_aval = [(t, shingles(t)) for t, _ in avaliacao]
    limpos = []
    for e in novos:
        sim, parecido = mais_parecido(e["texto"], ref_aval)
        if sim >= LIMIAR_CONTAMINACAO:
            relatorio["contaminação"] += 1
            descartes.append((e, f"contaminação ({parecido[:40]}…)", sim))
        else:
            limpos.append(e)

    # 5. rótulos contestados pelo aluno atual (heurística barata; o juiz com --api é mais confiável)
    prever = treinar(treino)
    suspeitos = [e for e in limpos if (p := prever(e["texto"]))[0] != e["categoria"] and p[1] >= 0.85]
    return limpos, suspeitos, descartes, relatorio


def diversidade(textos):
    bigramas = [tuple(p[i:i + 2]) for t in textos for p in [palavras(t)] for i in range(len(p) - 1)]
    return len(set(bigramas)) / max(1, len(bigramas))


if __name__ == "__main__":
    treino, teste = carregar("treino"), carregar("teste")
    novos_reais = [(d["texto"], d["categoria"]) for d in map(json.loads, (DADOS / "chamados_novos.jsonl").read_text(encoding="utf-8").splitlines())]

    if "--api" in sys.argv:
        candidatos = gerar_com_api(treino)
        origem = "gerados agora pelo claude-opus-5-5"
    else:
        candidatos = [json.loads(l) for l in (DADOS / "sinteticos_exemplo.jsonl").read_text(encoding="utf-8").splitlines()]
        origem = "dados/sinteticos_exemplo.jsonl (exemplo pronto, com problemas plantados)"
    print(f"Candidatos: {len(candidatos)} · {origem}\n")

    limpos, suspeitos, descartes, rel = pipeline(candidatos, treino, teste + novos_reais)
    print("Filtros:")
    for e, motivo, sim in descartes:
        plantado = f"  [plantado: {e['plantado']}]" if e.get("plantado") else ""
        print(f"  ✗ {motivo:<55} sim={sim:.2f}  «{e['texto'][:45]}…»{plantado}")
    print(f"  ? rótulo contestado pelo aluno (revisar): {len(suspeitos)}")
    for e in suspeitos:
        plantado = f"  [plantado: {e['plantado']}]" if e.get("plantado") else ""
        print(f"      {e['categoria']:<9} «{e['texto'][:60]}»{plantado}")

    if "--api" in sys.argv:
        limpos, reprovados = julgar_com_api(limpos)
        print(f"  ✗ reprovados pelo juiz: {len(reprovados)}")
    else:
        # sem juiz, o revisor humano decide os suspeitos; aqui seguimos o aluno e descartamos
        limpos = [e for e in limpos if e not in suspeitos]

    plantados = [e for e in candidatos if e.get("plantado")]
    if plantados:
        pegos = sum(1 for e in plantados if e not in limpos)
        print(f"\nProblemas plantados pegos pelos filtros: {pegos}/{len(plantados)}")

    cont = Counter(e["categoria"] for e in limpos)
    print(f"\nAprovados: {len(limpos)} · por categoria: " + ", ".join(f"{c} {cont[c]}" for c in CATS))
    vocab_treino = {w for t, _ in treino for w in tokens(t)}
    vocab_sint = {w for e in limpos for w in tokens(e["texto"])}
    print(f"Diversidade (bigramas distintos / total): treino {diversidade([t for t, _ in treino]):.2f} · sintéticos {diversidade([e['texto'] for e in limpos]):.2f}")
    print(f"Palavras dos sintéticos que o treino nunca viu: {len(vocab_sint - vocab_treino)} de {len(vocab_sint)}")

    print("\nEfeito no aluno (regressão logística do Lab 11.6):")
    print(f"  {'treino usado':<40}{'teste':>8}{'chamados novos':>16}")
    configs = {
        "só reais": treino,
        "reais + sintéticos filtrados": treino + [(e["texto"], e["categoria"]) for e in limpos],
        "reais + sintéticos SEM filtro": treino + [(e["texto"], e["categoria"]) for e in candidatos],
    }
    previsores = {nome: treinar(dados) for nome, dados in configs.items()}
    for nome, prever in previsores.items():
        print(f"  {nome:<40}{acerto(prever, teste):>8.0%}{acerto(prever, novos_reais):>16.0%}")

    # De onde vem cada ganho? Para cada chamado novo que mudou, o sintético mais parecido do treino usado.
    print("\nChamados novos que mudaram de resultado (✓ acertou, ✗ errou) e o sintético mais parecido:")
    nomes = list(previsores)
    for texto, cat in novos_reais:
        r = [previsores[n](texto)[0] == cat for n in nomes]
        if len(set(r)) == 1:
            continue
        marcas = " ".join("✓" if x else "✗" for x in r)
        ref = [(e["texto"], shingles(e["texto"])) for e in candidatos]
        sim, parecido = mais_parecido(texto, ref)
        print(f"  {marcas}  «{texto[:50]}»\n        mais parecido (sim={sim:.2f}): «{parecido[:60]}»")
    print(
        "\nColunas: só reais · filtrados · sem filtro. Os chamados novos são só 20, então cada um vale"
        "\n5 pontos percentuais: leia os ganhos caso a caso, como acima, e não só a porcentagem."
    )
