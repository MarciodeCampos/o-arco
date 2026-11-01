"""
Lab 6.1 — Os padrões de workflow que resolvem a maioria dos casos SEM agente.

Antes de construir um agente autônomo, tente um workflow: o código controla o
fluxo, o LLM executa passos bem definidos. Mais barato, previsível e testável.

  1. encadeamento (prompt chaining): a saída de um passo alimenta o próximo
  2. roteamento:      classificar e mandar para o tratamento certo
  3. paralelização:   várias chamadas independentes ao mesmo tempo
  4. avaliador-otimizador: um gera, outro critica, repete até ficar bom

    python 01_padroes_de_workflow.py
"""
import asyncio
import json

import anthropic

MODELO = "claude-opus-5-5"
RAPIDO = "claude-haiku-5-5"  # passos simples (classificar, criticar) podem usar um modelo menor
client = anthropic.AsyncAnthropic()

RECLAMACAO = (
    "Comprei uma cafeteira há 20 dias, pedido 7781. Parou de esquentar ontem. Já é a segunda vez que "
    "compro com vocês e dá problema. Quero meu dinheiro de volta, não quero outra cafeteira."
)


async def perguntar(prompt: str, modelo: str = MODELO, sistema: str = "", formato: dict | None = None) -> str:
    extras = {"output_config": {"effort": "low", **({"format": formato} if formato else {})}}
    r = await client.messages.create(
        model=modelo, max_tokens=2000, system=sistema, messages=[{"role": "user", "content": prompt}], **extras
    )
    return "".join(b.text for b in r.content if b.type == "text")


# ---------------------------------------------------------------- 1. encadeamento
async def encadeamento():
    print("1) ENCADEAMENTO: extrair → redigir → revisar\n")
    fatos = await perguntar(
        f"<reclamacao>{RECLAMACAO}</reclamacao>\nListe em tópicos curtos: produto, pedido, problema, pedido do cliente, tom.",
        modelo=RAPIDO,
    )
    # Portão de verificação entre passos: código comum checa se o passo 1 fez o trabalho.
    if "7781" not in fatos:
        raise RuntimeError("Passo 1 não encontrou o número do pedido; parando antes de gastar mais.")
    rascunho = await perguntar(f"Com base nestes fatos, escreva uma resposta ao cliente em até 4 frases:\n{fatos}")
    final = await perguntar(
        f"Revise a resposta: deve ser empática, não prometer reembolso antes da análise, e citar o pedido.\n"
        f"Devolva só a versão final.\n\n{rascunho}"
    )
    print(f"   fatos:\n{fatos}\n\n   resposta final:\n{final}\n")


# ---------------------------------------------------------------- 2. roteamento
FILAS = ["financeiro", "tecnico", "logistica", "comercial"]


async def roteamento():
    print("2) ROTEAMENTO: classificar e escolher o tratamento\n")
    esquema = {
        "type": "json_schema",
        "schema": {
            "type": "object",
            "properties": {"fila": {"type": "string", "enum": FILAS}, "urgente": {"type": "boolean"}},
            "required": ["fila", "urgente"],
            "additionalProperties": False,
        },
    }
    rota = json.loads(await perguntar(f"Classifique: <msg>{RECLAMACAO}</msg>", modelo=RAPIDO, formato=esquema))
    instrucoes = {
        "financeiro": "Explique o processo de reembolso e o prazo de análise.",
        "tecnico": "Peça detalhes do defeito e ofereça assistência técnica.",
        "logistica": "Informe o rastreio.",
        "comercial": "Responda a dúvida comercial.",
    }
    resposta = await perguntar(f"{instrucoes[rota['fila']]}\nCliente: {RECLAMACAO}")
    print(f"   rota: {rota}\n   resposta: {resposta[:200]}...\n")


# ---------------------------------------------------------------- 3. paralelização
async def paralelizacao():
    print("3) PARALELIZAÇÃO: três verificações independentes ao mesmo tempo\n")
    verificacoes = {
        "risco_juridico": "Esta mensagem indica risco de processo ou de reclamação no Procon? Responda sim ou não e por quê, em 1 frase.",
        "cliente_recorrente": "O cliente diz ser recorrente? Responda sim ou não, em 1 frase.",
        "sentimento": "Qual o sentimento, de -2 a 2? Responda o número e 1 frase.",
    }
    respostas = await asyncio.gather(
        *(perguntar(f"{q}\n<msg>{RECLAMACAO}</msg>", modelo=RAPIDO) for q in verificacoes.values())
    )
    for nome, r in zip(verificacoes, respostas):
        print(f"   {nome}: {r.strip()[:120]}")
    print()


# ---------------------------------------------------------------- 4. avaliador-otimizador
async def avaliador_otimizador(max_rodadas: int = 3):
    print("4) AVALIADOR-OTIMIZADOR: gerar, criticar, melhorar\n")
    criterios = "até 3 frases; cita o pedido 7781; pede desculpas; diz o próximo passo concreto; NÃO promete reembolso"
    texto = await perguntar(f"Responda ao cliente:\n{RECLAMACAO}")
    for rodada in range(1, max_rodadas + 1):
        esquema = {
            "type": "json_schema",
            "schema": {
                "type": "object",
                "properties": {"aprovado": {"type": "boolean"}, "problemas": {"type": "array", "items": {"type": "string"}}},
                "required": ["aprovado", "problemas"],
                "additionalProperties": False,
            },
        }
        critica = json.loads(
            await perguntar(f"Critérios: {criterios}\n\n<resposta>{texto}</resposta>\nAvalie.", modelo=RAPIDO, formato=esquema)
        )
        print(f"   rodada {rodada}: aprovado={critica['aprovado']} problemas={critica['problemas']}")
        if critica["aprovado"]:
            break
        texto = await perguntar(f"Reescreva corrigindo: {critica['problemas']}\nCritérios: {criterios}\n\n{texto}")
    print(f"\n   final: {texto}\n")


async def main():
    await encadeamento()
    await roteamento()
    await paralelizacao()
    await avaliador_otimizador()


asyncio.run(main())
