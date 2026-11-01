"""
Lab 15.4 — Simulador de entrevista de system design para sistemas com IA.

Um modelo faz o papel de entrevistador: apresenta o problema, responde às suas
perguntas de esclarecimento e aprofunda onde a resposta ficou rasa, sem entregar a
solução. Ao final, outro passo avalia a conversa contra os pontos esperados da
questão. Cada ponto marcado como coberto precisa citar um trecho SEU, e o código
confere se o trecho existe (a mesma regra das atas do Módulo 13).

    python 02_simulador_system_design.py                    # questão aleatória, modo interativo
    python 02_simulador_system_design.py suporte-rag        # questão específica
    python 02_simulador_system_design.py suporte-rag --respostas minhas_respostas.txt
        (respostas separadas por linha em branco; útil para repetir a mesma simulação)

Digite "fim" para encerrar e receber a avaliação.
"""
import json
import random
import sys
from pathlib import Path
from typing import Literal

import anthropic
from pydantic import BaseModel, Field

MODELO = "claude-opus-5-5"
PRECO = {"entrada": 4.00, "saida": 20.00}  # US$ por milhão de tokens
MAX_TURNOS = 12

questoes = json.loads((Path(__file__).parent.parent / "dados" / "questoes_system_design.json").read_text(encoding="utf-8"))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
questao = next((q for q in questoes if q["id"] == args[0]), None) if args else random.choice(questoes)
if questao is None:
    sys.exit(f"questão não encontrada; opções: {[q['id'] for q in questoes]}")

roteiro = None
if "--respostas" in sys.argv:
    texto = Path(sys.argv[sys.argv.index("--respostas") + 1]).read_text(encoding="utf-8")
    roteiro = [b.strip() for b in texto.split("\n\n") if b.strip()]

client = anthropic.Anthropic()
gasto = {"entrada": 0, "saida": 0}


def contabilizar(r):
    gasto["entrada"] += r.usage.input_tokens
    gasto["saida"] += r.usage.output_tokens


def checar(r):
    if r.stop_reason == "refusal":
        sys.exit("O modelo recusou continuar esta conversa.")


ENTREVISTADOR = f"""Você conduz uma entrevista de system design para uma vaga de engenharia de IA.
Problema: {questao['enunciado']}

Regras:
- Na primeira mensagem, apresente o problema em poucas frases e convide a pessoa a começar.
- Responda perguntas de esclarecimento com números plausíveis e consistentes entre si.
- Faça UMA pergunta por vez. Aprofunde onde a resposta foi vaga (custos, avaliação, falhas, segurança).
- Nunca entregue a solução nem dê nota durante a entrevista. Seja cordial e objetivo.
- Mensagens curtas: no máximo 4 frases."""

conversa = [{"role": "user", "content": "(A pessoa candidata entrou na sala.)"}]
falas_candidato: list[str] = []

for turno in range(MAX_TURNOS):
    r = client.messages.create(model=MODELO, max_tokens=600, system=ENTREVISTADOR, messages=conversa,
                               output_config={"effort": "low"})
    checar(r)
    contabilizar(r)
    fala = "".join(b.text for b in r.content if b.type == "text")
    conversa.append({"role": "assistant", "content": fala})
    print(f"\nEntrevistador: {fala}\n")

    if roteiro is not None:
        if not roteiro:
            break
        resposta = roteiro.pop(0)
        print(f"Você: {resposta}")
    else:
        resposta = input("Você: ").strip()
    if resposta.lower() in {"fim", "sair"}:
        break
    falas_candidato.append(resposta)
    conversa.append({"role": "user", "content": resposta})

if not falas_candidato:
    sys.exit("Nenhuma resposta para avaliar.")


class Ponto(BaseModel):
    ponto: str
    cobertura: Literal["coberto", "parcial", "ausente"]
    evidencia: str | None = Field(description="Trecho EXATO dito pela pessoa candidata, copiado sem alterar; null se ausente")
    comentario: str


class Avaliacao(BaseModel):
    pontos: list[Ponto]
    pontos_fortes: list[str]
    melhorias: list[str] = Field(description="Até 3 melhorias concretas, da mais importante para a menos")
    recomendacao: Literal["abaixo_do_esperado", "dentro_do_esperado", "acima_do_esperado"]


transcricao = "\n".join(
    f"{'ENTREVISTADOR' if m['role'] == 'assistant' else 'CANDIDATO'}: {m['content']}" for m in conversa[1:]
)
pontos = "\n".join(f"- {p}" for p in questao["pontos_esperados"])
r = client.messages.parse(
    model=MODELO,
    max_tokens=4000,
    system=("Você avalia entrevistas de system design de forma justa e específica. Avalie só o que a pessoa candidata "
            "disse, não o entrevistador. Se um ponto não apareceu, marque ausente. Evidências devem ser copiadas literalmente."),
    messages=[{"role": "user", "content": f"<pontos_esperados>\n{pontos}\n</pontos_esperados>\n<transcricao>\n{transcricao}\n</transcricao>"}],
    output_config={"effort": "medium"},
    output_format=Avaliacao,
)
checar(r)
contabilizar(r)
av = r.parsed_output
if av is None:
    sys.exit("Não foi possível interpretar a avaliação.")

falas = "\n".join(falas_candidato)
print("\n" + "=" * 60 + "\nAVALIAÇÃO\n")
for p in av.pontos:
    if p.cobertura != "ausente" and (not p.evidencia or p.evidencia.strip() not in falas):
        p.comentario = f"[evidência não encontrada nas suas falas; rebaixado para ausente] {p.comentario}"
        p.cobertura = "ausente"
    marca = {"coberto": "✓", "parcial": "~", "ausente": "✗"}[p.cobertura]
    print(f"{marca} {p.ponto}\n    {p.comentario}")
    if p.cobertura != "ausente":
        print(f"    você disse: \"{p.evidencia}\"")

cobertos = sum(p.cobertura == "coberto" for p in av.pontos)
print(f"\nCobertura: {cobertos}/{len(av.pontos)} pontos completos")
print("Pontos fortes:", *[f"\n  + {x}" for x in av.pontos_fortes])
print("Melhorias:", *[f"\n  → {x}" for x in av.melhorias])
print(f"Recomendação: {av.recomendacao.replace('_', ' ')}")
custo = (gasto["entrada"] * PRECO["entrada"] + gasto["saida"] * PRECO["saida"]) / 1e6
print(f"\nCusto da simulação: US$ {custo:.4f} ({gasto['entrada']} tokens de entrada, {gasto['saida']} de saída)")
