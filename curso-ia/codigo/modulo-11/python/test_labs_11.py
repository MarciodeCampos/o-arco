"""Testes dos Labs 11.8 e 11.9 sem API:  python test_labs_11.py  (ou pytest)."""
import importlib.util
from pathlib import Path


def carregar(arquivo):
    spec = importlib.util.spec_from_file_location(arquivo[:-3], Path(__file__).with_name(arquivo))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


sint = carregar("05_dados_sinteticos.py")
cap = carregar("06_capacidade_gpu.py")


def test_numeros_viram_marcador():
    a = sint.shingles("Quero mudar o endereço do pedido 12345")
    b = sint.shingles("Quero mudar o endereço do pedido 98")
    assert sint.jaccard(a, b) == 1.0


def test_textos_diferentes_tem_similaridade_baixa():
    a = sint.shingles("O controle remoto não funciona")
    b = sint.shingles("Qual o prazo de entrega para Salvador?")
    assert sint.jaccard(a, b) == 0.0


def test_pipeline_remove_duplicata_e_contaminacao():
    treino = [("O purificador parou de ligar depois de 3 dias", "defeito")] * 3 + [("Quero o estorno da cobrança de R$ 10,00", "cobranca")] * 3
    avaliacao = [("Qual o prazo de entrega para Salvador?", "entrega")]
    cand = [
        {"texto": "a tampa veio com a trava quebrada e não fecha", "categoria": "defeito"},
        {"texto": "a tampa veio com a trava quebrada e não fecha", "categoria": "defeito"},
        {"texto": "O purificador parou de ligar depois de 7 dias", "categoria": "defeito"},
        {"texto": "Qual o prazo de entrega para Recife?", "categoria": "entrega"},
    ]
    limpos, _, descartes, rel = sint.pipeline(cand, treino, avaliacao)
    assert [e["texto"] for e in limpos] == ["a tampa veio com a trava quebrada e não fecha"]
    assert rel == {"duplicata": 1, "cópia do treino": 1, "contaminação": 1}


def test_kv_cache_llama_8b():
    # 2 × 32 camadas × 8 cabeças KV × 128 × 2 bytes = 128 KiB por token
    assert cap.kv_por_token(32, 8, 128) == 128 * 1024


def test_70b_16_bits_nao_cabe_em_80gb():
    assert cap.capacidade("Llama 3.1 70B", "16 bits", 80, 8000)[3] == 0


def test_quantizar_aumenta_conversas():
    c16 = cap.capacidade("Llama 3.1 8B", "16 bits", 24, 8000)[3]
    c4 = cap.capacidade("Llama 3.1 8B", "4 bits", 24, 8000)[3]
    assert c4 > c16 > 0


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f(); print("ok", nome)
