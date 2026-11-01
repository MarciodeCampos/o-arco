"""
Lab 10.5 — Detecção de anomalias e linha do tempo de incidente (sem API).

1. Detecta anomalias em métricas com z-score sobre uma janela móvel: simples,
   explicável e um bom ponto de partida antes de modelos mais sofisticados.
2. Monta a linha do tempo do incidente juntando anomalias, deploys, alertas e chat:
   a matéria-prima do post-mortem. (No projeto, um LLM transforma isso em texto.)

    python 02_anomalias_e_timeline.py
"""
import json
import statistics
from pathlib import Path

dados = json.loads((Path(__file__).parent.parent / "dados" / "incidente_metricas.json").read_text(encoding="utf-8"))
pontos, eventos = dados["pontos"], dados["eventos"]
JANELA, LIMIAR = 15, 4.0  # 15 minutos de referência; 4 desvios-padrão


def anomalias(serie: str, robusto: bool = True) -> list[tuple[str, float, float]]:
    """z-score contra a janela anterior. Na versão robusta, pontos já marcados como
    anômalos NÃO entram na referência: senão o detector "se acostuma" com o incidente."""
    achados, normais = [], [p[serie] for p in pontos[:JANELA]]
    for i in range(JANELA, len(pontos)):
        ref = normais[-JANELA:] if robusto else [p[serie] for p in pontos[i - JANELA : i]]
        media, desvio = statistics.mean(ref), statistics.pstdev(ref) or 1e-9
        z = (pontos[i][serie] - media) / desvio
        if z > LIMIAR:
            achados.append((pontos[i]["hora"], pontos[i][serie], z))
        else:
            normais.append(pontos[i][serie])
    return achados


ingenuo = anomalias("taxa_erro_pct", robusto=False)
robusto = anomalias("taxa_erro_pct")
print("Detector INGÊNUO (janela inclui os próprios pontos anômalos):")
print(f"  {len(ingenuo)} minutos anômalos: {', '.join(h for h, _, _ in ingenuo)}")
print("Detector ROBUSTO (anomalias ficam fora da referência):")
print(f"  {len(robusto)} minutos anômalos: {', '.join(h for h, _, _ in robusto)}\n")

linha_do_tempo = [(e["hora"], e["fonte"], e["texto"]) for e in eventos]
for serie, unidade in [("taxa_erro_pct", "%"), ("latencia_p95_ms", " ms"), ("requisicoes_s", " req/s")]:
    achados = anomalias(serie)
    print(f"{serie}: {len(achados)} pontos anômalos" + (f" (de {achados[0][0]} a {achados[-1][0]})" if achados else ""))
    if achados:
        inicio = achados[0]
        linha_do_tempo.append((inicio[0], "anomalia", f"{serie} começou a subir: {inicio[1]}{unidade} (z = {inicio[2]:.0f})"))

print("\nLINHA DO TEMPO")
for hora, fonte, texto in sorted(linha_do_tempo):
    print(f"  {hora}  {fonte:<9} {texto}")

pico = max(pontos, key=lambda p: p["taxa_erro_pct"])
print(f"\nPico: {pico['taxa_erro_pct']}% de erro às {pico['hora']}.")
print("Repare: a anomalia começa logo depois do deploy das 10:33. requisicoes_s não muda: não foi tráfego.")
print(
    "\nPerguntas do post-mortem (sem culpados):\n"
    "  - Por que o deploy passou pelo CI com uma configuração inválida?\n"
    "  - O alerta disparou 2 min depois do início: dá para detectar antes (ex.: no canário do deploy)?\n"
    "  - O rollback levou 7 min: dá para automatizar com aprovação, como no projeto do módulo?"
)
