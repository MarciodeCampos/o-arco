"""
Lab 6.5 — Por que agentes ficam caros, e o que fazer a respeito. Sem API.

Num loop de agente, o histórico inteiro é reenviado a cada passo. Se cada passo
adiciona T tokens, o passo n lê ~n·T tokens: o total cresce com o QUADRADO do
número de passos. Simulamos um agente de 30 passos e comparamos quatro estratégias.

    python 03_custo_de_agentes.py
"""
P_ENTRADA, P_SAIDA, P_CACHE_LEITURA, P_CACHE_ESCRITA = 4.00, 20.00, 0.20, 5.00  # US$/1M, claude-opus-5-5
SISTEMA = 3_000          # prompt de sistema + definições de ferramentas
POR_PASSO_SAIDA = 300    # o que o modelo escreve por passo (raciocínio + chamada)
POR_PASSO_RESULTADO = 2_500  # o que cada ferramenta devolve
PASSOS = 30


def simular(cache: bool, manter_resultados: int | None) -> tuple[float, int]:
    custo = 0.0
    maior_contexto = 0
    historico_ja_cacheado = 0
    resultados: list[int] = []  # tamanho de cada resultado ainda no histórico
    saidas = 0
    for _ in range(PASSOS):
        if manter_resultados is not None:
            # poda: resultados antigos viram um marcador de ~20 tokens
            resultados = [20 if i < len(resultados) - manter_resultados else r for i, r in enumerate(resultados)]
        contexto = SISTEMA + saidas + sum(resultados)
        maior_contexto = max(maior_contexto, contexto)
        if cache:
            lido = min(historico_ja_cacheado, contexto)
            novo = contexto - lido
            # com poda, o prefixo muda e o cache só vale até o primeiro trecho podado: aproximação conservadora
            if manter_resultados is not None:
                lido, novo = SISTEMA, contexto - SISTEMA
            custo += (lido * P_CACHE_LEITURA + novo * P_CACHE_ESCRITA) / 1e6
            historico_ja_cacheado = contexto
        else:
            custo += contexto * P_ENTRADA / 1e6
        custo += POR_PASSO_SAIDA * P_SAIDA / 1e6
        saidas += POR_PASSO_SAIDA
        resultados.append(POR_PASSO_RESULTADO)
    return custo, maior_contexto


print(f"Agente de {PASSOS} passos · cada ferramenta devolve {POR_PASSO_RESULTADO} tokens\n")
print(f"{'estratégia':<38} {'custo':>9} {'maior contexto':>16}")
for nome, cache, poda in [
    ("sem nada", False, None),
    ("cache de prompt", True, None),
    ("poda: mantém 5 resultados", False, 5),
    ("poda (5) + cache só do sistema", True, 5),
]:
    custo, maior = simular(cache, poda)
    print(f"{nome:<38} US$ {custo:5.2f} {maior:>13,} tok".replace(",", "."))

print("\nCusto por passo SEM nada (repare no crescimento):")
for n in [1, 10, 20, 30]:
    contexto = SISTEMA + (n - 1) * (POR_PASSO_SAIDA + POR_PASSO_RESULTADO)
    print(f"  passo {n:>2}: lê {contexto:>7,} tokens → US$ {contexto * P_ENTRADA / 1e6:.3f}".replace(",", "."))

print(
    "\nLições:\n"
    " - O custo de um agente é dominado pela RELEITURA do histórico, não pelo que ele escreve.\n"
    " - Cache de prompt é a maior economia de custo: o histórico relido sai a uma fração do preço.\n"
    " - Poda (e compactação) reduz o TAMANHO do contexto, o que importa para não estourar a janela e\n"
    "   para a qualidade (menos ruído). Mas ela muda o prefixo e quebra o cache: podar a cada passo\n"
    "   com cache pode sair mais caro. Faça a poda em blocos, raramente, ou só quando o contexto ficar grande.\n"
    " - Resultados de ferramenta enxutos (Módulo 5) economizam nas duas frentes.\n"
    " - Orçamento de passos não é só segurança: é controle de custo."
)
