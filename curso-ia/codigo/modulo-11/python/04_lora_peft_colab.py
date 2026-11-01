"""
Lab 11.5b — LoRA de verdade num modelo aberto pequeno, com Hugging Face PEFT.

⚠ Requer GPU (Google Colab gratuito com T4 serve) e acesso ao Hugging Face.
  Este script NÃO roda no ambiente de testes do curso (sem GPU e sem download de
  modelos); lá, ele só passa por checagem de sintaxe. Confira as versões das
  bibliotecas se algo mudou de API.

No Colab:
    !pip install -q "transformers>=4.45" "peft>=0.13" torch
    # envie a pasta dados/preparado/ (gerada pelo 01_preparar_dataset.py)
    !python 04_lora_peft_colab.py

O que faz: ajusta um modelo instruct pequeno (0,5 B de parâmetros, licença Apache 2.0)
para classificar chamados, treinando só adaptadores LoRA nas projeções de atenção, e
mede o acerto antes e depois no conjunto de teste e nos chamados novos.
"""
import json
import time
from pathlib import Path

import torch
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

MODELO = "Qwen/Qwen2.5-0.5B-Instruct"
PASTA = Path(__file__).parent.parent / "dados"
dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(0)


def carregar(arquivo):
    return [json.loads(l)["messages"] for l in (PASTA / arquivo).read_text(encoding="utf-8").splitlines()]


treino, teste = carregar("preparado/treino.jsonl"), carregar("preparado/teste.jsonl")
novos = [
    [teste[0][0], {"role": "user", "content": d["texto"]}, {"role": "assistant", "content": d["categoria"]}]
    for d in map(json.loads, (PASTA / "chamados_novos.jsonl").read_text(encoding="utf-8").splitlines())
]

tok = AutoTokenizer.from_pretrained(MODELO)
modelo = AutoModelForCausalLM.from_pretrained(MODELO, torch_dtype=torch.bfloat16 if dispositivo == "cuda" else torch.float32).to(dispositivo)


@torch.no_grad()
def avaliar(conjunto, nome):
    modelo.eval()
    certos = 0
    for msgs in conjunto:
        prompt = tok.apply_chat_template(msgs[:2], tokenize=False, add_generation_prompt=True)
        ids = tok(prompt, return_tensors="pt").to(dispositivo)
        saida = modelo.generate(**ids, max_new_tokens=5, do_sample=False)
        resposta = tok.decode(saida[0, ids["input_ids"].shape[1] :], skip_special_tokens=True).strip().lower()
        certos += resposta.startswith(msgs[2]["content"])
    print(f"  {nome:<22} {certos}/{len(conjunto)} = {certos / len(conjunto):.0%}")


print("ANTES do ajuste (só o prompt de sistema):")
avaliar(teste, "teste")
avaliar(novos, "chamados novos")

# LoRA nas projeções de atenção q e v: o alvo mais comum, e barato.
config = LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05, target_modules=["q_proj", "v_proj"], task_type="CAUSAL_LM")
modelo = get_peft_model(modelo, config)
modelo.print_trainable_parameters()


def exemplo(msgs):
    """Tokeniza a conversa e só calcula a perda na RESPOSTA (o rótulo), não no prompt."""
    prompt = tok.apply_chat_template(msgs[:2], tokenize=False, add_generation_prompt=True)
    completo = prompt + msgs[2]["content"] + tok.eos_token
    ids = tok(completo, return_tensors="pt")["input_ids"][0]
    n_prompt = len(tok(prompt)["input_ids"])
    rotulos = ids.clone()
    rotulos[:n_prompt] = -100  # -100 = ignorado na perda
    return ids, rotulos


otimizador = torch.optim.AdamW([p for p in modelo.parameters() if p.requires_grad], lr=2e-4)
modelo.train()
inicio = time.time()
for epoca in range(2):
    total = 0.0
    for i, msgs in enumerate(treino):
        ids, rotulos = exemplo(msgs)
        perda = modelo(input_ids=ids[None].to(dispositivo), labels=rotulos[None].to(dispositivo)).loss
        perda.backward()
        if (i + 1) % 8 == 0:  # acumula gradientes de 8 exemplos (lote efetivo 8)
            otimizador.step()
            otimizador.zero_grad()
        total += perda.item()
    print(f"época {epoca + 1}: perda média {total / len(treino):.4f}")
print(f"treino em {time.time() - inicio:.0f}s")

print("\nDEPOIS do ajuste:")
avaliar(teste, "teste")
avaliar(novos, "chamados novos")

modelo.save_pretrained("adaptador-chamados")  # só o adaptador: poucos MB, não o modelo inteiro
print("\nadaptador salvo em adaptador-chamados/ (carregue sobre o mesmo modelo base)")
