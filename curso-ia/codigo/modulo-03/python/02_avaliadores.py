"""
Lab 3.3 — Avaliadores baseados em código: do rígido demais ao frouxo demais.

Rodamos vários avaliadores sobre as mesmas saídas e comparamos com o
julgamento humano (coluna "certo?"). Sem chamar API.

    python 02_avaliadores.py
"""
import json
import re
import unicodedata

from pydantic import BaseModel, ValidationError


# ------------------------------------------------------------------ avaliadores
def exato(saida: str, esperado: str) -> bool:
    return saida == esperado


def normalizado(saida: str, esperado: str) -> bool:
    """Ignora maiúsculas, acentos, espaços e pontuação nas pontas."""

    def norm(t: str) -> str:
        t = unicodedata.normalize("NFKD", t.lower().strip())
        t = "".join(c for c in t if not unicodedata.combining(c))
        return re.sub(r"\s+", " ", t).strip(" .!")

    return norm(saida) == norm(esperado)


def numero(saida: str, esperado: float, tolerancia: float = 0.01) -> bool:
    """Extrai o número da resposta (aceita 'R$ 1.234,56', '1234.56', 'Total: 1234,56')."""
    m = re.search(r"-?\d[\d.,]*", saida)
    if not m:
        return False
    bruto = m.group()
    if "," in bruto:  # formato brasileiro: ponto de milhar, vírgula decimal
        bruto = bruto.replace(".", "").replace(",", ".")
    try:
        return abs(float(bruto) - esperado) <= tolerancia
    except ValueError:
        return False


def contem(saida: str, esperado: str) -> bool:
    """Frouxo: aceita qualquer resposta que contenha o esperado."""
    return esperado.lower() in saida.lower()


class Endereco(BaseModel):
    cidade: str
    uf: str
    cep: str


def esquema(saida: str) -> bool:
    try:
        Endereco.model_validate_json(saida)
        return True
    except ValidationError:
        return False


# ------------------------------------------------------------------ casos: (pergunta, saída, esperado, humano acha certo?)
casos_texto = [
    ("capital", "Brasília", "Brasília", True),
    ("capital", "brasilia.", "Brasília", True),
    ("capital", "  Brasília ", "Brasília", True),
    ("capital", "A capital do Brasil é Brasília.", "Brasília", True),
    ("capital", "Não é Brasília, é o Rio de Janeiro.", "Brasília", False),
    ("capital", "Rio de Janeiro", "Brasília", False),
]
casos_numero = [
    ("total", "R$ 1.234,56", 1234.56, True),
    ("total", "1234.56", 1234.56, True),
    ("total", "Total: 1234,56 reais", 1234.56, True),
    ("total", "1234,5", 1234.56, False),
    ("total", "Não consegui ler o total", 1234.56, False),
]
casos_json = [
    ('{"cidade": "Recife", "uf": "PE", "cep": "50030-230"}', True),
    ('```json\n{"cidade": "Recife", "uf": "PE", "cep": "50030-230"}\n```', True),  # humano aceita; schema não
    ('{"cidade": "Recife", "uf": "PE"}', False),
]

print("Texto — o humano decide se a resposta está certa; cada avaliador concorda?\n")
print(f"{'saída':<40} {'certo?':>7} {'exato':>7} {'normal.':>8} {'contém':>7}")
erros = {"exato": 0, "normalizado": 0, "contem": 0}
for _, saida, esp, humano in casos_texto:
    r = {"exato": exato(saida, esp), "normalizado": normalizado(saida, esp), "contem": contem(saida, esp)}
    for k, v in r.items():
        erros[k] += v != humano
    marca = lambda v: ("✓" if v else "✗") + ("" if v == humano else "!")
    print(f"{json.dumps(saida, ensure_ascii=False)[:38]:<40} {'✓' if humano else '✗':>7} {marca(r['exato']):>7} {marca(r['normalizado']):>8} {marca(r['contem']):>7}")
print(f"\ndiscordâncias com o humano: {erros}   (! marca cada discordância)")
print("→ 'exato' é rígido demais (reprova respostas certas); 'contém' é frouxo demais (aprova a errada).\n")

print("Número com tolerância:\n")
for _, saida, esp, humano in casos_numero:
    r = numero(saida, esp)
    print(f"  {saida:<28} certo? {'✓' if humano else '✗'}   avaliador: {'✓' if r else '✗'}{'' if r == humano else '  ← discorda'}")

print("\nValidação de schema (Pydantic):\n")
for saida, humano in casos_json:
    r = esquema(saida)
    print(f"  {saida.replace(chr(10), ' ')[:60]:<62} certo? {'✓' if humano else '✗'}   schema: {'✓' if r else '✗'}{'' if r == humano else '  ← discorda'}")
print(
    "\nDiscordâncias apontam o que ajustar: normalizar a entrada (tirar a cerca ```json), "
    "ou usar saída estruturada na API para o problema nem existir."
)
