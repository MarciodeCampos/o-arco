"""
Lab 1.7 — Sua primeira chamada a um LLM por API, medindo tokens e custo.

Pré-requisitos:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY="sua-chave"   # https://platform.claude.com

Rode:
    python 04_primeira_chamada.py
    python 04_primeira_chamada.py "Explique embeddings para uma criança de 10 anos"

Para trocar de modelo:  MODELO=claude-sonnet-5-5 python 04_primeira_chamada.py
"""
import os
import sys

import anthropic

MODELO = os.environ.get("MODELO", "claude-opus-5-5")

# Preço em US$ por 1 milhão de tokens (entrada, saída), conferido em nov/2026.
# Preços mudam: confira sempre em https://platform.claude.com/docs/en/about-claude/pricing
PRECOS = {
    "claude-opus-5-5": (4.00, 20.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-haiku-5-5": (0.10, 0.50),
}

pergunta = " ".join(sys.argv[1:]) or "Em 3 frases: o que é um token em um LLM?"

client = anthropic.Anthropic()  # lê ANTHROPIC_API_KEY do ambiente

try:
    resposta = client.beta.messages.create(
        model=MODELO,
        max_tokens=2000,
        system="Você é um professor de engenharia de IA. Responda em português do Brasil, de forma clara e curta.",
        messages=[{"role": "user", "content": pergunta}],
        # Esforço de raciocínio: "low" basta para perguntas simples e economiza tokens.
        output_config={"effort": "low"},
        # Se o modelo recusar por um filtro de segurança, o servidor tenta outro modelo.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
except TypeError as erro:
    # O SDK levanta TypeError quando não encontra nenhuma credencial.
    if "authentication" not in str(erro):
        raise
    sys.exit("Nenhuma credencial encontrada. Defina ANTHROPIC_API_KEY.")
except anthropic.AuthenticationError:
    sys.exit("Chave inválida ou ausente. Defina ANTHROPIC_API_KEY.")
except anthropic.RateLimitError:
    sys.exit("Limite de requisições atingido. Espere um pouco e tente de novo.")
except anthropic.APIStatusError as erro:
    sys.exit(f"Erro da API ({erro.status_code}): {erro.message}")
except anthropic.APIConnectionError:
    sys.exit("Sem conexão com a API. Verifique sua internet.")

# Sempre confira o motivo de parada antes de usar o conteúdo.
if resposta.stop_reason == "refusal":
    sys.exit("O modelo recusou a solicitação.")
if resposta.stop_reason == "max_tokens":
    print("[aviso] resposta cortada por max_tokens\n")

for bloco in resposta.content:
    if bloco.type == "text":
        print(bloco.text)

uso = resposta.usage
print("\n--- uso ---")
print(f"modelo:          {resposta.model}")
print(f"tokens entrada:  {uso.input_tokens}")
print(f"tokens saída:    {uso.output_tokens}  (inclui o raciocínio interno do modelo)")

if resposta.model in PRECOS:
    p_in, p_out = PRECOS[resposta.model]
    custo = uso.input_tokens / 1e6 * p_in + uso.output_tokens / 1e6 * p_out
    print(f"custo estimado:  US$ {custo:.6f}")
    print(f"1.000 chamadas:  US$ {custo * 1000:.2f}")
