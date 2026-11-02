"""Testes da nota do Lab 4.8:  python test_extracao.py  (ou pytest)."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("lab", Path(__file__).with_name("03_extracao_de_documentos.py"))
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)

LINHAS = [["Plano Básico", "1.240", "1.315"], ["Plano Família (até 4 telas)", "2.875", "2.910"]]


def test_tabela_em_ordem_ganha_tudo():
    assert lab.nota_tabela("Plano Básico 1.240 1.315\nPlano Família 2.875 2.910", LINHAS) == (4, 4)


def test_tabela_markdown_conta():
    md = "| Plano Básico | 1.240 | 1.315 |\n| Plano Família (até 4 telas) | 2.875 | 2.910 |"
    assert lab.nota_tabela(md, LINHAS) == (4, 4)


def test_valor_na_linha_errada_nao_conta():
    assert lab.nota_tabela("Plano Básico 2.875 1.240\nPlano Família 1.315 2.910", LINHAS)[0] == 2


def test_rotulo_perdido_zera_a_linha():
    assert lab.nota_tabela("Plano Básico 1.240 1.315\n(até colas) 2.875 2.910", LINHAS) == (2, 4)


def test_numero_parcial_nao_conta():
    assert lab.nota_tabela("Plano Básico 11.240 1.3150", LINHAS[:1]) == (0, 2)


def test_colunas_intercaladas_perdem_frases():
    frases = ["A central abriu em março.", "A manutenção será no dia 14."]
    certo = "A central abriu\nem março.\nA manutenção será\nno dia 14."
    intercalado = "A central abriu A manutenção será\nem março. no dia 14."
    assert lab.nota_ordem(certo, frases) == (2, 2)
    assert lab.nota_ordem(intercalado, frases) == (0, 2)


def test_hifenizacao_na_quebra_e_aceita():
    assert lab.nota_ordem("A manu-\ntenção será no dia 14.", ["A manutenção será no dia 14."]) == (1, 1)


def test_campos():
    assert lab.nota_campos("CPF: 123.456.789-09 Valor: R$ 149,90", {"cpf": "123.456.789-09", "valor": "R$ 149,90", "x": "nada"}) == (2, 3)


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f(); print("ok", nome)
