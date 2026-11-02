"""
Servidor SIMULADO compatível com /v1/chat/completions (streaming), para o Lab 11.9 sem GPU.

Imita o comportamento de um servidor com lote contínuo (continuous batching), como o vLLM:
- a cada passo, gera um token para TODAS as conversas ativas de uma vez;
- o passo fica mais lento quanto mais conversas ativas (custo por conversa no lote);
- há um limite de conversas no lote; as demais esperam na fila (o tempo até o primeiro token sobe);
- o prefill (ler o prompt) custa tempo proporcional ao tamanho do prompt.

Os números são parâmetros de simulação, não medições de nenhuma GPU. Servem para ver a forma das
curvas (vazão sobe com a concorrência até saturar; latência sobe junto) e testar o medidor.

    python servidor_simulado.py              # porta 8000
    python servidor_simulado.py 8001 --lote 8
"""
import json
import queue
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PASSO_BASE_MS = 12.0       # tempo de um passo de decodificação com 1 conversa
PASSO_POR_CONVERSA_MS = 0.6  # acréscimo por conversa ativa no lote
PREFILL_MS_POR_TOKEN = 0.05
LOTE_MAX = int(sys.argv[sys.argv.index("--lote") + 1]) if "--lote" in sys.argv else 32

fila: "queue.Queue[dict]" = queue.Queue()
ativas: list[dict] = []
trava = threading.Lock()


def agendador():
    while True:
        with trava:
            while len(ativas) < LOTE_MAX and not fila.empty():
                c = fila.get()
                time.sleep(c["prompt_tokens"] * PREFILL_MS_POR_TOKEN / 1000)  # prefill de quem entra
                ativas.append(c)
            lote = list(ativas)
        if not lote:
            time.sleep(0.002)
            continue
        time.sleep((PASSO_BASE_MS + PASSO_POR_CONVERSA_MS * len(lote)) / 1000)
        for c in lote:
            c["saida"].put("tok ")
            c["restantes"] -= 1
            if c["restantes"] <= 0:
                c["saida"].put(None)
                with trava:
                    ativas.remove(c)


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def do_POST(self):
        corpo = json.loads(self.rfile.read(int(self.headers["content-length"])))
        prompt = " ".join(m.get("content", "") for m in corpo.get("messages", []))
        c = {"prompt_tokens": max(1, len(prompt) // 4), "restantes": int(corpo.get("max_tokens", 128)), "saida": queue.Queue()}
        fila.put(c)
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("transfer-encoding", "chunked")
        self.end_headers()
        cid = "chatcmpl-" + uuid.uuid4().hex[:8]

        def enviar(dados: str):
            b = f"data: {dados}\n\n".encode()
            self.wfile.write(f"{len(b):x}\r\n".encode() + b + b"\r\n")
            self.wfile.flush()

        while (tok := c["saida"].get()) is not None:
            enviar(json.dumps({"id": cid, "object": "chat.completion.chunk", "choices": [{"index": 0, "delta": {"content": tok}}]}))
        enviar("[DONE]")
        self.wfile.write(b"0\r\n\r\n")


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8000
    threading.Thread(target=agendador, daemon=True).start()
    print(f"Servidor SIMULADO em http://127.0.0.1:{porta}/v1 · lote máximo {LOTE_MAX}")
    ThreadingHTTPServer.request_queue_size = 256   # o padrão (5) recusa conexões sob carga
    ThreadingHTTPServer(("127.0.0.1", porta), H).serve_forever()
