"""
Lab 4.8 — Extração de documentos difíceis, com nota.

Compara métodos de extração em três PDFs (tabela, duas colunas, página escaneada) contra um
gabarito. O RAG só é tão bom quanto o texto que entra nele: se a tabela vira uma lista solta de
números, nenhuma busca recupera "quantos assinantes o Plano Família tinha em fevereiro".

    python ../documentos/gerar_pdfs.py          # uma vez: gera os PDFs e o gabarito
    python 03_extracao_de_documentos.py          # métodos locais
    python 03_extracao_de_documentos.py --claude # inclui o Claude lendo o PDF (precisa de ANTHROPIC_API_KEY)

Métodos:
  pypdf       camada de texto do PDF, do jeito que vier
  pdfplumber  camada de texto + tabelas detectadas, em markdown
  ocr         imagem da página (pdftoppm) + Tesseract em português
  hibrido     escolhe por página: OCR se não há texto, tabelas em markdown, colunas lidas separadamente
  claude      o modelo recebe o PDF (texto e imagem de cada página) e transcreve em markdown
"""
import base64
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pdfplumber
from pypdf import PdfReader

DOCS = Path(__file__).parent.parent / "documentos"
GABARITO = json.loads((DOCS / "gabarito.json").read_text(encoding="utf-8"))


# ------------------------------------------------------------------ nota
def normalizar(t: str) -> str:
    t = t.replace("|", " ").replace("*", " ")
    t = re.sub(r"-\n(?=\w)", "", t)          # palavra hifenizada na quebra de linha
    return re.sub(r"\s+", " ", t).strip()


def nota_tabela(texto: str, linhas: list[list[str]]) -> tuple[int, int]:
    """Uma célula conta se o valor aparece depois do rótulo da sua linha, antes do rótulo da próxima, na ordem certa."""
    t = normalizar(texto)
    rotulos = [" ".join(l[0].split()[:2]) for l in linhas]
    certas = total = 0
    for i, linha in enumerate(linhas):
        total += len(linha) - 1
        ini = t.find(rotulos[i])
        if ini < 0:
            continue
        fins = [t.find(r, ini + len(rotulos[i])) for r in rotulos[i + 1:]]
        fim = min([f for f in fins if f > 0], default=len(t))
        trecho, pos = t[ini:fim], 0
        for valor in linha[1:]:
            achou = re.search(rf"(?<![\d.]){re.escape(valor)}(?![\d.])", trecho[pos:])
            if achou:
                certas += 1
                pos += achou.end()
    return certas, total


def nota_ordem(texto: str, frases: list[str]) -> tuple[int, int]:
    t = normalizar(texto)
    return sum(normalizar(f) in t for f in frases), len(frases)


def nota_campos(texto: str, campos: dict) -> tuple[int, int]:
    t = normalizar(texto)
    return sum(normalizar(v) in t for v in campos.values()), len(campos)


def avaliar(nome: str, texto: str) -> tuple[int, int]:
    g = GABARITO[nome]
    if g["tipo"] == "tabela":
        return nota_tabela(texto, g["linhas"])
    if g["tipo"] == "ordem":
        return nota_ordem(texto, g["frases"])
    return nota_campos(texto, g["campos"])


# ------------------------------------------------------------------ métodos
def m_pypdf(pdf: Path) -> str:
    return "\n".join(p.extract_text() or "" for p in PdfReader(pdf).pages)


def tabela_md(tabela) -> str:
    linhas = [[(c or "").replace("\n", " ") for c in l] for l in tabela]
    md = ["| " + " | ".join(linhas[0]) + " |", "|" + "---|" * len(linhas[0])]
    md += ["| " + " | ".join(l) + " |" for l in linhas[1:]]
    return "\n".join(md)


def m_pdfplumber(pdf: Path) -> str:
    partes = []
    with pdfplumber.open(pdf) as doc:
        for p in doc.pages:
            partes.append(p.extract_text() or "")
            partes += [tabela_md(t) for t in p.extract_tables()]
    return "\n\n".join(partes)


def m_ocr(pdf: Path) -> str:
    if not (shutil.which("pdftoppm") and shutil.which("tesseract")):
        raise RuntimeError("instale poppler-utils e tesseract-ocr (+ tesseract-ocr-por)")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-r", "300", "-png", str(pdf), f"{tmp}/p"], check=True)
        textos = []
        for img in sorted(Path(tmp).glob("p*.png")):
            r = subprocess.run(["tesseract", str(img), "-", "-l", "por"], capture_output=True, text=True, check=True)
            textos.append(r.stdout)
    return "\n".join(textos)


def colunas(pagina) -> list:
    """Se as palavras do corpo têm um vão vertical no meio da página, devolve as duas metades."""
    palavras = [w for w in pagina.extract_words() if w["top"] > pagina.height * 0.15]
    if len(palavras) < 30:
        return [pagina]
    meio = pagina.width / 2
    atravessam = sum(1 for w in palavras if w["x0"] < meio - 5 < w["x1"] or w["x0"] < meio + 5 < w["x1"])
    if atravessam > len(palavras) * 0.02:
        return [pagina]
    return [pagina.crop((0, 0, meio, pagina.height)), pagina.crop((meio, 0, pagina.width, pagina.height))]


def m_hibrido(pdf: Path) -> str:
    partes = []
    with pdfplumber.open(pdf) as doc:
        for i, p in enumerate(doc.pages):
            if not (p.extract_text() or "").strip():
                with tempfile.TemporaryDirectory() as tmp:  # página sem texto: OCR só desta página
                    unica = Path(tmp) / "p.pdf"
                    subprocess.run(["pdfseparate", "-f", str(i + 1), "-l", str(i + 1), str(pdf), str(unica)], check=True)
                    partes.append(m_ocr(unica))
                continue
            tabelas = p.find_tables()
            if tabelas:
                fora = p
                for t in tabelas:  # texto fora das tabelas + tabelas em markdown
                    fora = fora.filter(lambda o, b=t.bbox: not (b[0] <= o.get("x0", 0) <= b[2] and b[1] <= o.get("top", 0) <= b[3]))
                partes.append(fora.extract_text() or "")
                partes += [tabela_md(t.extract()) for t in tabelas]
                continue
            partes += [c.extract_text() or "" for c in colunas(p)]
    return "\n\n".join(partes)


def m_claude(pdf: Path) -> tuple[str, float]:
    import anthropic

    client = anthropic.Anthropic()
    r = client.messages.create(
        model="claude-opus-5-5",
        max_tokens=8000,
        messages=[{"role": "user", "content": [
            {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                            "data": base64.standard_b64encode(pdf.read_bytes()).decode()}},
            {"type": "text", "text": (
                "Transcreva este documento em markdown, completo e literal. Siga a ordem de leitura humana "
                "(em texto com colunas, termine uma coluna antes de começar a outra). Tabelas viram tabelas "
                "markdown com todas as linhas e colunas. Não resuma, não corrija e não acrescente nada.")},
        ]}],
        output_config={"effort": "low"},
    )
    if r.stop_reason == "refusal":
        raise RuntimeError("o modelo recusou")
    custo = (r.usage.input_tokens * 4 + r.usage.output_tokens * 20) / 1e6
    return "".join(b.text for b in r.content if b.type == "text"), custo


# ------------------------------------------------------------------ execução
if __name__ == "__main__":
    if not (DOCS / "relatorio_tabela.pdf").exists():
        sys.exit("Rode antes: python ../documentos/gerar_pdfs.py")
    metodos = {"pypdf": m_pypdf, "pdfplumber": m_pdfplumber, "ocr": m_ocr, "hibrido": m_hibrido}
    if "--claude" in sys.argv:
        metodos["claude"] = m_claude
    nomes = list(GABARITO)
    print(f"{'método':<11}" + "".join(f"{n.split('_')[0][:9]:>12}" for n in nomes) + f"{'total':>9}{'tempo':>9}{'custo':>10}")
    for m, f in metodos.items():
        linha, certas, total, gasto, t0 = f"{m:<11}", 0, 0, 0.0, time.time()
        for n in nomes:
            try:
                saida = f(DOCS / n)
                if isinstance(saida, tuple):
                    saida, c = saida
                    gasto += c
                ok, tot = avaliar(n, saida)
            except Exception as e:  # um método que quebra vale zero, mas não derruba o lab
                print(f"  ({m} falhou em {n}: {e})", file=sys.stderr)
                ok, tot = 0, avaliar(n, "")[1]
            certas, total = certas + ok, total + tot
            linha += f"{ok:>7}/{tot:<4}"
        custo = f"US${gasto:.4f}" if m == "claude" else "-"
        print(linha + f"{100 * certas / total:>8.0f}%{time.time() - t0:>8.1f}s{custo:>10}")
