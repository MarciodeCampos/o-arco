"""
Lab 9.5 — Planejamento de capacidade e custo de um sistema com LLM (sem API).

Perguntas que todo arquiteto precisa responder antes do lançamento:
  - quantas requisições simultâneas vamos ter? (lei de Little)
  - cabem nos limites de taxa do provedor (requisições/min e tokens/min)?
  - quanto custa por mês, e quanto economizamos com roteamento, cache e batch?

Edite o CENARIO e rode:
    python 01_capacidade.py
"""
CENARIO = {
    "usuarios_ativos_por_dia": 20_000,
    "conversas_por_usuario": 1.5,
    "chamadas_por_conversa": 4,          # turnos + chamadas internas (classificação, ferramentas)
    "tokens_entrada_por_chamada": 3_000,
    "tokens_saida_por_chamada": 400,
    "latencia_media_s": 6.0,             # duração média de uma chamada
    "fator_pico": 4.0,                   # pico de tráfego / média
    "horas_ativas_por_dia": 12,
}
LIMITES = {"requisicoes_por_min": 4_000, "tokens_entrada_por_min": 2_000_000}  # exemplo: veja os do seu plano
PRECOS = {"claude-opus-5-5": (4.00, 20.00), "claude-sonnet-5-5": (2.00, 10.00), "claude-haiku-5-5": (0.10, 0.50)}

c = CENARIO


def num(n: float) -> str:
    """Formata com ponto de milhar (padrão brasileiro), sem mexer no resto do texto."""
    return f"{n:,.0f}".replace(",", ".")


chamadas_dia = c["usuarios_ativos_por_dia"] * c["conversas_por_usuario"] * c["chamadas_por_conversa"]
media_por_s = chamadas_dia / (c["horas_ativas_por_dia"] * 3600)
pico_por_s = media_por_s * c["fator_pico"]

print("TRÁFEGO")
print(f"  chamadas por dia:            {num(chamadas_dia):>12}")
print(f"  média / pico por segundo:    {media_por_s:>8.1f} / {pico_por_s:.1f}")
# Lei de Little: itens em andamento = taxa de chegada × tempo no sistema
concorrencia = pico_por_s * c["latencia_media_s"]
print(f"  chamadas simultâneas no pico: {concorrencia:>7.0f}   (lei de Little: taxa × latência)")

print("\nLIMITES DO PROVEDOR (no pico)")
rpm = pico_por_s * 60
tpm = rpm * c["tokens_entrada_por_chamada"]
for nome, uso, limite in [("requisições/min", rpm, LIMITES["requisicoes_por_min"]), ("tokens de entrada/min", tpm, LIMITES["tokens_entrada_por_min"])]:
    pct = uso / limite
    alerta = "  ⚠ NO LIMITE OU ACIMA: vai receber 429 no pico" if pct >= 1 else ("  ⚠ pouca folga" if pct > 0.7 else "")
    print(f"  {nome:<22} {num(uso):>12} de {num(limite):>10} ({pct:.0%}){alerta}")

print("\nCUSTO MENSAL (30 dias)")
tok_in = chamadas_dia * 30 * c["tokens_entrada_por_chamada"]
tok_out = chamadas_dia * 30 * c["tokens_saida_por_chamada"]


def custo(modelo, fracao=1.0, cache_leitura=0.0, desconto_batch=0.0):
    p_in, p_out = PRECOS[modelo]
    entrada = tok_in * fracao * ((1 - cache_leitura) * p_in + cache_leitura * p_in * 0.1)
    return (entrada + tok_out * fracao * p_out) / 1e6 * (1 - desconto_batch)


cenarios = {
    "tudo no claude-opus-5-5": custo("claude-opus-5-5"),
    "tudo no claude-sonnet-5-5": custo("claude-sonnet-5-5"),
    "roteado: 60% haiku, 30% sonnet, 10% opus": custo("claude-haiku-5-5", 0.6) + custo("claude-sonnet-5-5", 0.3) + custo("claude-opus-5-5", 0.1),
    "roteado + 50% da entrada vinda do cache": custo("claude-haiku-5-5", 0.6, 0.5) + custo("claude-sonnet-5-5", 0.3, 0.5) + custo("claude-opus-5-5", 0.1, 0.5),
}
base = cenarios["tudo no claude-opus-5-5"]
for nome, v in cenarios.items():
    print(f"  {nome:<44} US$ {num(v):>8}/mês  ({v / base:.0%})")
print("  (cache: leitura a ~10% do preço de entrada; o valor exato varia por modelo)")

print(
    "\nO que fazer com esses números:\n"
    "  - Concorrência alta → pool de conexões, filas e limites por cliente no gateway.\n"
    "  - Perto do limite de taxa → peça aumento ao provedor, espalhe entre modelos, use batch no que não é urgente.\n"
    "  - Custo → roteamento por tarefa e cache são as maiores alavancas; meça a qualidade de cada rota (Módulo 3)."
)
