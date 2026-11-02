"""
Lab 11.9 (parte 2) — Teste de carga de um servidor de LLM, em níveis de concorrência.

Funciona com qualquer servidor compatível com /v1/chat/completions em streaming: vLLM,
llama.cpp (llama-server), Ollama, TGI com a API de mensagens, ou o servidor_simulado.py.

Mede, para cada nível de concorrência:
  TTFT     tempo até o primeiro token (o que o usuário sente como "começou a responder")
  ITL      intervalo entre tokens (a fluidez do texto aparecendo)
  latência tempo total da resposta
  vazão    tokens por segundo somando todas as conversas (o que define o custo por token)

    python servidor_simulado.py &                     # ou um servidor real
    python 07_teste_de_carga.py
    python 07_teste_de_carga.py --url http://localhost:8000/v1 --modelo Qwen/Qwen2.5-7B-Instruct
    python 07_teste_de_carga.py --url http://localhost:11434/v1 --modelo qwen2.5:7b --niveis 1,2,4

Só biblioteca padrão. Não rode contra servidores de terceiros sem autorização.
"""
import http.client
import json
import statistics
import sys
import threading
import time
from urllib.parse import urlparse


def arg(nome, padrao):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else padrao


URL = urlparse(arg("--url", "http://127.0.0.1:8000/v1"))
MODELO = arg("--modelo", "simulado")
NIVEIS = [int(x) for x in arg("--niveis", "1,4,16,32,64").split(",")]
POR_NIVEL = int(arg("--pedidos", "2"))   # pedidos por conversa simultânea em cada nível
MAX_TOKENS = int(arg("--max-tokens", "128"))
PROMPT = "Explique em um parágrafo o que é lote contínuo em servidores de LLM. " * 4


def um_pedido() -> dict:
    conn = (http.client.HTTPSConnection if URL.scheme == "https" else http.client.HTTPConnection)(URL.hostname, URL.port, timeout=300)
    corpo = json.dumps({"model": MODELO, "messages": [{"role": "user", "content": PROMPT}],
                        "max_tokens": MAX_TOKENS, "stream": True, "temperature": 0})
    t0 = time.perf_counter()
    conn.request("POST", URL.path.rstrip("/") + "/chat/completions", corpo, {"content-type": "application/json"})
    r = conn.getresponse()
    if r.status != 200:
        raise RuntimeError(f"HTTP {r.status}: {r.read()[:200]!r}")
    marcas = []
    for linha in r:
        linha = linha.strip()
        if not linha.startswith(b"data:"):
            continue
        dado = linha[5:].strip()
        if dado == b"[DONE]":
            break
        delta = json.loads(dado)["choices"][0].get("delta", {})
        if delta.get("content"):
            marcas.append(time.perf_counter())
    conn.close()
    if not marcas:
        raise RuntimeError("nenhum token recebido")
    itl = [b - a for a, b in zip(marcas, marcas[1:])]
    return {"ttft": marcas[0] - t0, "total": marcas[-1] - t0, "tokens": len(marcas), "itl": statistics.median(itl) if itl else 0}


def p(valores, q):
    return statistics.quantiles(valores, n=100)[q - 1] if len(valores) > 1 else valores[0]


def nivel(concorrencia: int):
    resultados, erros, trava = [], [], threading.Lock()

    def trabalhador():
        for _ in range(POR_NIVEL):
            try:
                r = um_pedido()
                with trava:
                    resultados.append(r)
            except Exception as e:
                with trava:
                    erros.append(str(e))

    t0 = time.perf_counter()
    ts = [threading.Thread(target=trabalhador) for _ in range(concorrencia)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    duracao = time.perf_counter() - t0
    return resultados, erros, duracao


if __name__ == "__main__":
    print(f"Alvo: {URL.geturl()} · modelo {MODELO} · {MAX_TOKENS} tokens por resposta\n")
    print(f"{'simult.':>8}{'TTFT p50':>10}{'TTFT p95':>10}{'ITL p50':>9}{'lat p50':>9}{'lat p95':>9}{'vazão tok/s':>13}{'erros':>7}")
    for c in NIVEIS:
        res, erros, dur = nivel(c)
        if not res:
            print(f"{c:>8}  todos falharam: {erros[:1]}")
            continue
        ttft = [r["ttft"] for r in res]
        lat = [r["total"] for r in res]
        vazao = sum(r["tokens"] for r in res) / dur
        print(f"{c:>8}{p(ttft, 50) * 1000:>8.0f}ms{p(ttft, 95) * 1000:>8.0f}ms"
              f"{statistics.median(r['itl'] for r in res) * 1000:>7.0f}ms{p(lat, 50):>8.1f}s{p(lat, 95):>8.1f}s"
              f"{vazao:>13.0f}{len(erros):>7}")
        if erros:
            print(f"          exemplo de erro: {erros[0][:90]}")
    print(
        "\nComo ler: a vazão total sobe com a concorrência enquanto o servidor junta conversas no mesmo lote;"
        "\ncada usuário, porém, vê o texto sair mais devagar (ITL) e esperar mais pelo começo (TTFT)."
        "\nO ponto de operação é a maior concorrência em que o p95 ainda cumpre o seu SLO."
    )
