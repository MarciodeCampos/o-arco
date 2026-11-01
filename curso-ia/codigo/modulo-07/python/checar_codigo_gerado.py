"""
Lab 7.6 — Checagens automáticas para código gerado por IA (sem API).

Agentes de código escrevem muito código, rápido. Algumas classes de problema
aparecem com frequência e são fáceis de detectar mecanicamente. Este script é
uma triagem barata que roda antes da revisão humana (e no "verificar" do
repositório-modelo). Ele não substitui SAST de verdade (Semgrep, CodeQL...).

    python checar_codigo_gerado.py caminho/para/src
    python checar_codigo_gerado.py exemplos_ruins      # veja os achados
"""
import re
import sys
from pathlib import Path

REGRAS = [
    ("alta", "segredo no código", r"""(api[_-]?key|secret|senha|password|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}["']"""),
    ("alta", "chave de API com formato conhecido", r"sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}"),
    ("alta", "eval / execução dinâmica de código", r"\beval\s*\(|new Function\s*\(|\bexec\s*\("),
    ("alta", "SQL montado com concatenação ou template", r"""(SELECT|INSERT|UPDATE|DELETE)\b[^;\n]*(\$\{|"\s*\+|'\s*\+|%s|\.format\()"""),
    ("média", "dinheiro com ponto flutuante", r"\b(preco|valor|total|subtotal|desconto)\w*\s*[*+\-/]=?\s*0\.\d+"),
    ("média", "data/hora atual dentro de código de cálculo", r"new Date\(\)|Date\.now\(\)|datetime\.now\(\)"),
    ("média", "erro engolido em silêncio", r"catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}|except\s*(Exception)?\s*:\s*pass"),
    ("média", "TLS desativado", r"rejectUnauthorized\s*:\s*false|verify\s*=\s*False|NODE_TLS_REJECT_UNAUTHORIZED"),
    ("baixa", "TODO/FIXME deixado pelo gerador", r"\b(TODO|FIXME|XXX)\b"),
    ("baixa", "console.log esquecido", r"console\.log\("),
]
EXTENSOES = {".ts", ".js", ".tsx", ".jsx", ".py", ".mjs"}


def checar(raiz: Path) -> list[tuple[str, str, str, int, str]]:
    achados = []
    arquivos = [raiz] if raiz.is_file() else [p for p in raiz.rglob("*") if p.suffix in EXTENSOES and "node_modules" not in p.parts]
    for arq in sorted(arquivos):
        for n, linha in enumerate(arq.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            for sev, nome, padrao in REGRAS:
                if re.search(padrao, linha, re.I if sev != "baixa" else 0):
                    achados.append((sev, nome, str(arq), n, linha.strip()[:90]))
    return achados


if __name__ == "__main__":
    raiz = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    achados = checar(raiz)
    ordem = {"alta": 0, "média": 1, "baixa": 2}
    for sev, nome, arq, n, trecho in sorted(achados, key=lambda a: (ordem[a[0]], a[2], a[3])):
        print(f"[{sev:>5}] {nome}\n        {arq}:{n}  {trecho}")
    altas = sum(1 for a in achados if a[0] == "alta")
    print(f"\n{len(achados)} achados ({altas} de severidade alta) em {raiz}")
    sys.exit(1 if altas else 0)  # severidade alta reprova a verificação
