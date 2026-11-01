"""Testes do verificador:  python -m pytest test_verificar_projeto.py  (ou python test_verificar_projeto.py)"""
import tempfile
from pathlib import Path

from verificar_projeto import verificar

MODELO = Path(__file__).with_name("MODELO_README.md").read_text(encoding="utf-8")


def criar(arquivos: dict[str, str]) -> Path:
    raiz = Path(tempfile.mkdtemp())
    for nome, conteudo in arquivos.items():
        p = raiz / nome
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(conteudo, encoding="utf-8")
    return raiz


def por_item(resultado):
    return {r["item"]: r["ok"] for r in resultado}


def test_projeto_completo_passa_em_tudo():
    raiz = criar({
        "README.md": MODELO,
        "ARQUITETURA.md": "# Arquitetura",
        "CLAUDE.md": "# Regras",
        "ficha.md": "# Ficha do sistema",
        ".env.example": "ANTHROPIC_API_KEY=",
        ".github/workflows/ci.yml": "on: pull_request",
        "prompts/classificar.v1.json": "{}",
        "src/gateway.ts": "registrar({ usage, custo })",
        "test/gateway.test.ts": "test()",
        "evals/casos.jsonl": "{}",
    })
    assert all(r["ok"] for r in verificar(raiz))


def test_projeto_vazio_falha_nos_obrigatorios():
    falhas = [r["item"] for r in verificar(criar({"x.txt": ""})) if r["obrigatorio"] and not r["ok"]]
    assert "README na raiz" in falhas and "testes automatizados" in falhas and "dataset de avaliação (evals)" in falhas


def test_detecta_chave_vazada_e_env_versionado():
    chave = "sk-ant-api03-" + "x" * 30
    r = por_item(verificar(criar({"src/config.ts": f'const k = "{chave}"', ".env": "A=1"})))
    assert r["sem segredos no repositório"] is False
    assert r["sem .env versionado"] is False


def test_ignora_node_modules():
    chave = "sk-ant-api03-" + "x" * 30
    r = por_item(verificar(criar({"node_modules/pacote/teste.js": chave})))
    assert r["sem segredos no repositório"] is True


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f(); print("ok", nome)
