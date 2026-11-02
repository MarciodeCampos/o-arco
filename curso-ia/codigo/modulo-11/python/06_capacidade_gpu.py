"""
Lab 11.9 (parte 1) — Quanto de GPU um modelo aberto precisa, e quantos usuários cabem.

A memória de uma GPU servindo um LLM vai para três lugares:
  pesos      parâmetros × bytes por parâmetro (16 bits = 2 bytes; 8 bits = 1; 4 bits = 0,5)
  KV cache   para cada token em atenção, cada camada guarda chave e valor:
             2 × camadas × cabeças_kv × dim_cabeça × bytes   (por token)
  sobra      ativações, kernels e fragmentação; aqui, 10% da GPU

O KV cache é o que limita quantas conversas cabem ao mesmo tempo. Servidores como o vLLM
reservam ~90% da GPU (gpu_memory_utilization=0.9) e usam o que sobra dos pesos para KV cache.

    python 06_capacidade_gpu.py
    python 06_capacidade_gpu.py --contexto 32000

Estimativa de ordem de grandeza. Confira a arquitetura no config.json do modelo
(num_hidden_layers, num_key_value_heads, head_dim ou hidden_size / num_attention_heads)
e meça no servidor de verdade antes de comprar ou reservar GPU.
"""
import sys

# parâmetros (bilhões), camadas, cabeças KV, dimensão da cabeça — do config.json de cada modelo
MODELOS = {
    "Qwen2.5 7B": (7.6, 28, 4, 128),
    "Llama 3.1 8B": (8.0, 32, 8, 128),
    "Mistral 7B v0.3": (7.2, 32, 8, 128),
    "Llama 3.1 70B": (70.6, 80, 8, 128),
}
PRECISOES = {"16 bits": 2.0, "8 bits": 1.0, "4 bits": 0.5}
GPUS = {"L4 24 GB": 24, "L40S 48 GB": 48, "A100/H100 80 GB": 80, "2× H100 160 GB": 160}
UTILIZACAO = 0.90   # fração da GPU que o servidor reserva
SOBRA = 0.10        # fração da GPU para ativações e fragmentação

GiB = 1024**3


def kv_por_token(camadas, kv, dim, bytes_kv=2.0):
    return 2 * camadas * kv * dim * bytes_kv


def capacidade(modelo, precisao, gpu_gb, contexto):
    params, camadas, kv, dim = MODELOS[modelo]
    pesos = params * 1e9 * PRECISOES[precisao]
    gpu = gpu_gb * 1e9
    livre = gpu * UTILIZACAO - pesos - gpu * SOBRA
    por_token = kv_por_token(camadas, kv, dim)          # KV cache em 16 bits, o padrão
    if livre <= 0:
        return pesos, por_token, 0, 0
    tokens = livre / por_token
    return pesos, por_token, int(tokens), int(tokens // contexto)


if __name__ == "__main__":
    contexto = int(sys.argv[sys.argv.index("--contexto") + 1]) if "--contexto" in sys.argv else 8000
    print("KV cache por token (16 bits):")
    for m, (_, c, kv, d) in MODELOS.items():
        b = kv_por_token(c, kv, d)
        print(f"  {m:<16} {b / 1024:>6.0f} KiB/token · uma conversa de {contexto:,} tokens = {b * contexto / GiB:.2f} GiB".replace(",", "."))

    print(f"\nConversas simultâneas com {contexto:,} tokens de contexto cada (0 = não cabe):".replace(",", "."))
    print(f"  {'modelo':<16}{'precisão':<10}" + "".join(f"{g:>17}" for g in GPUS))
    for m in MODELOS:
        for p in PRECISOES:
            linha = f"  {m:<16}{p:<10}"
            for g, gb in GPUS.items():
                pesos, _, _, conversas = capacidade(m, p, gb, contexto)
                linha += f"{conversas:>17}" if conversas else f"{'—':>17}"
            print(linha)
    print(
        "\nLeitura: a conta de 'cabe na GPU' não é só o tamanho dos pesos. Um modelo de 70B em 4 bits"
        "\ncabe numa GPU de 80 GB, mas sobra pouco KV cache: poucas conversas longas ao mesmo tempo."
        "\nQuantizar os pesos libera memória; contexto longo e muitos usuários a consomem."
    )
