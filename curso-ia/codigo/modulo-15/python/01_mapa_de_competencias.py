"""
Lab 15.1 — Mapa de competências por nível (sem API).

Você dá notas de 0 a 4 em cada área (0 = nunca fiz, 2 = fiz com ajuda,
3 = faço sozinho em produção, 4 = ensino e defino o padrão). O script compara com
o que costuma ser esperado em cada nível, mostra as maiores lacunas para o nível
desejado e sugere módulos e uma peça de portfólio para cada uma.

    python 01_mapa_de_competencias.py                                  # usa o exemplo
    python 01_mapa_de_competencias.py minha_autoavaliacao.json senior

As expectativas são uma referência para conversa, não uma régua oficial de empresa.
"""
import json
import sys
from pathlib import Path

NIVEIS = ["junior", "pleno", "senior", "staff"]

# área: (expectativa por nível júnior, pleno, sênior, staff), módulos, peça de portfólio
AREAS = {
    "fundamentos":           ((2, 3, 3, 3), "1",       "explicação escrita de tokens, atenção e amostragem com código"),
    "apis_e_contexto":       ((2, 3, 4, 4), "2",       "extrator com saída estruturada, cache e custo medido"),
    "avaliacao":             ((1, 3, 4, 4), "3",       "suíte de evals com IC 95% rodando no CI"),
    "rag":                   ((1, 3, 3, 4), "4",       "RAG com busca híbrida, citações e métricas de recuperação"),
    "mcp_e_ferramentas":     ((1, 2, 3, 4), "5",       "servidor MCP com testes e transporte HTTP autenticado"),
    "agentes":               ((1, 2, 3, 4), "6, 10",   "agente com orçamento, aprovação e avaliação de trajetória"),
    "front_end_e_ux":        ((2, 3, 3, 3), "8",       "interface com streaming, cancelamento e acessibilidade"),
    "producao_e_llmops":     ((0, 2, 4, 4), "9",       "gateway com reserva, rollout de prompt e painel de custos"),
    "seguranca":             ((1, 2, 3, 4), "12",      "red team automatizado com canário e correções"),
    "modelos_abertos":       ((0, 1, 2, 3), "11",      "comparação destilação vs modelo grande, com teste fora da distribuição"),
    "produto_e_comunicacao": ((1, 2, 3, 4), "13, 14",  "README de produto com números e decisões"),
    "lideranca_tecnica":     ((0, 1, 3, 4), "7, 15",   "documento de arquitetura ou guia adotado por outro time"),
}


def nivel_atual(notas: dict[str, int]) -> str:
    atual = "abaixo de junior"
    for i, nivel in enumerate(NIVEIS):
        faltas = sum(1 for a, (esp, _, _) in AREAS.items() if notas.get(a, 0) < esp[i])
        if faltas <= 2:          # tolerância: ninguém é completo em tudo
            atual = nivel
        else:
            break
    return atual


if __name__ == "__main__":
    arquivo = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "dados" / "autoavaliacao_exemplo.json"
    alvo = sys.argv[2] if len(sys.argv) > 2 else "pleno"
    if alvo not in NIVEIS:
        sys.exit(f"nível deve ser um de {NIVEIS}")
    dados = json.loads(arquivo.read_text(encoding="utf-8"))
    notas = dados["notas"]
    faltando = [a for a in AREAS if a not in notas]
    if faltando:
        print(f"Aviso: sem nota para {', '.join(faltando)} (contadas como 0)\n")
    i = NIVEIS.index(alvo)

    print(f"{'área':<24}{'nota':>5}{'esperado (' + alvo + ')':>20}")
    lacunas = []
    for area, (esp, mods, peca) in AREAS.items():
        nota = notas.get(area, 0)
        marca = "" if nota >= esp[i] else f"  ▼ {esp[i] - nota}"
        print(f"{area:<24}{nota:>5}{esp[i]:>20}{marca}")
        if nota < esp[i]:
            lacunas.append((esp[i] - nota, area, mods, peca))

    print(f"\nNível estimado hoje: {nivel_atual(notas)} · alvo: {alvo}")
    if not lacunas:
        print("Nenhuma lacuna para o alvo. Considere o próximo nível.")
    else:
        print("\nPlano (maiores lacunas primeiro):")
        for k, (gap, area, mods, peca) in enumerate(sorted(lacunas, key=lambda x: -x[0])[:4], 1):
            print(f"{k}. {area} (+{gap}): revisar Módulo {mods}; peça de portfólio: {peca}")
