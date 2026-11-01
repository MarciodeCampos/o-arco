"""
Lab 13.3 — Da transcrição da reunião às tarefas no board, sem tarefas inventadas.

O modelo extrai decisões, tarefas (com responsável e prazo) e riscos. A regra que
torna isso confiável: CADA item precisa citar o trecho da transcrição de onde saiu,
e o código confere se a citação existe de verdade. Item sem citação real é descartado
e listado para revisão humana.

    python 01_reuniao_para_tarefas.py
    python 01_reuniao_para_tarefas.py caminho/para/transcricao.txt
Gera tarefas_board.csv (importável em Jira, Trello, Notion, Planilhas...).
"""
import csv
import re
import sys
from pathlib import Path

import anthropic
from pydantic import BaseModel, Field


class Tarefa(BaseModel):
    titulo: str = Field(description="Verbo no infinitivo + objeto, até 80 caracteres")
    responsavel: str | None = Field(description="Nome de quem assumiu na reunião; null se ninguém assumiu")
    prazo: str | None = Field(description="Prazo dito na reunião, como foi dito; null se não houve")
    criterio_de_aceite: str
    citacao: str = Field(description="Trecho EXATO da transcrição que origina a tarefa, copiado sem alterar")


class Item(BaseModel):
    texto: str
    citacao: str = Field(description="Trecho EXATO da transcrição, copiado sem alterar")


class Ata(BaseModel):
    decisoes: list[Item]
    tarefas: list[Tarefa]
    riscos: list[Item]
    pendencias_sem_dono: list[Item]


arquivo = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "dados" / "reuniao.txt"
transcricao = arquivo.read_text(encoding="utf-8")

client = anthropic.Anthropic()
r = client.messages.parse(
    model="claude-opus-5-5",
    max_tokens=8000,
    system=(
        "Você transforma transcrições de reunião em atas acionáveis. Registre só o que foi dito: não crie tarefas "
        "que ninguém assumiu (essas vão em pendencias_sem_dono) e não invente prazos. Toda citação deve ser copiada "
        "literalmente da transcrição."
    ),
    messages=[{"role": "user", "content": f"<transcricao>\n{transcricao}\n</transcricao>"}],
    output_config={"effort": "medium"},
    output_format=Ata,
)
ata = r.parsed_output
if ata is None:
    sys.exit("Não foi possível interpretar a ata.")

normalizar = lambda s: re.sub(r"\s+", " ", s).strip().lower()
texto_norm = normalizar(transcricao)
citacao_real = lambda c: len(c.strip()) >= 12 and normalizar(c) in texto_norm

# Checagem em código: o que não tem citação verificável não entra no board.
validas = [t for t in ata.tarefas if citacao_real(t.citacao)]
suspeitas = [t for t in ata.tarefas if not citacao_real(t.citacao)]

print("DECISÕES")
for d in ata.decisoes:
    print(f"  {'✓' if citacao_real(d.citacao) else '?'} {d.texto}")
print("\nTAREFAS")
for t in validas:
    print(f"  ✓ {t.titulo} — {t.responsavel or 'SEM RESPONSÁVEL'} — prazo: {t.prazo or 'não definido'}")
for t in suspeitas:
    print(f"  ✗ DESCARTADA (citação não encontrada na transcrição): {t.titulo}")
print("\nRISCOS")
for x in ata.riscos:
    print(f"  ⚠ {x.texto}")
print("\nPENDÊNCIAS SEM DONO (precisam de responsável)")
for x in ata.pendencias_sem_dono:
    print(f"  • {x.texto}")

with open("tarefas_board.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["Título", "Responsável", "Prazo", "Critério de aceite", "Origem (citação)"])
    for t in validas:
        w.writerow([t.titulo, t.responsavel or "", t.prazo or "", t.criterio_de_aceite, t.citacao])
print(f"\n{len(validas)} tarefas em tarefas_board.csv · {len(suspeitas)} descartadas para revisão")
