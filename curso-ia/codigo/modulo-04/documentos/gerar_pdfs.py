"""
Gera os três PDFs difíceis do Lab 4.8 e o gabarito com o que precisa ser extraído de cada um.

    python gerar_pdfs.py

- relatorio_tabela.pdf     tabela com números, células de duas linhas e linha de total
- boletim_duas_colunas.pdf texto em duas colunas: a ordem de leitura importa
- contrato_escaneado.pdf   página que é só uma imagem (sem camada de texto), levemente torta

Requer reportlab e Pillow. Os dados são fictícios.
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

AQUI = Path(__file__).parent
estilos = getSampleStyleSheet()

# ---------------------------------------------------------------- 1. tabela
LINHAS = [
    ("Plano Básico", "1.240", "1.315", "1.402"),
    ("Plano Família\n(até 4 telas)", "2.875", "2.910", "3.064"),
    ("Plano Empresas", "418", "455", "497"),
    ("Cancelamentos", "-96", "-120", "-88"),
]
TOTAL = ("Total", "4.437", "4.560", "4.875")


def gerar_tabela():
    doc = SimpleDocTemplate(str(AQUI / "relatorio_tabela.pdf"), pagesize=A4)
    dados = [["Assinaturas ativas", "Jan/2026", "Fev/2026", "Mar/2026"]] + [list(l) for l in LINHAS] + [list(TOTAL)]
    t = Table(dados, colWidths=[6 * cm, 3 * cm, 3 * cm, 3 * cm])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    doc.build([
        Paragraph("Relatório trimestral de assinaturas", estilos["Title"]),
        Paragraph("Valores em número de contratos ativos no último dia de cada mês.", estilos["Normal"]),
        Spacer(1, 0.6 * cm), t,
        Spacer(1, 0.6 * cm),
        Paragraph("Observação: o Plano Família teve reajuste em fevereiro.", estilos["Normal"]),
    ])


# ---------------------------------------------------------------- 2. duas colunas
ESQUERDA = [
    "A nova central de atendimento passou a funcionar em março, com horário estendido até as 22 horas nos dias úteis.",
    "O tempo médio de espera caiu de onze para quatro minutos depois da mudança, segundo a equipe de operações.",
    "Clientes do plano empresarial agora têm um canal exclusivo, com retorno garantido em até duas horas.",
]
DIREITA = [
    "A manutenção da rede no bairro Jardim Botânico está prevista para o dia 14, entre uma e cinco da manhã.",
    "Durante a janela, a conexão pode oscilar, mas não haverá cobrança proporcional pela interrupção.",
    "Quem trabalha em turno noturno pode pedir um modem reserva pelo aplicativo até o dia 12.",
]


def gerar_colunas():
    caminho = str(AQUI / "boletim_duas_colunas.pdf")
    doc = BaseDocTemplate(caminho, pagesize=A4)
    largura = (doc.width - 1 * cm) / 2
    topo = doc.bottomMargin + doc.height - 3 * cm
    titulo = Frame(doc.leftMargin, topo, doc.width, 3 * cm, id="titulo")
    esq = Frame(doc.leftMargin, doc.bottomMargin, largura, doc.height - 3 * cm, id="esq")
    dir_ = Frame(doc.leftMargin + largura + 1 * cm, doc.bottomMargin, largura, doc.height - 3 * cm, id="dir")
    doc.addPageTemplates([PageTemplate(frames=[titulo, esq, dir_])])
    from reportlab.platypus import FrameBreak
    corpo = estilos["BodyText"]
    historia = [Paragraph("Boletim do cliente · abril", estilos["Title"]), FrameBreak()]
    historia += [Paragraph("Atendimento", estilos["Heading2"])] + [Paragraph(f, corpo) for f in ESQUERDA] + [FrameBreak()]
    historia += [Paragraph("Manutenção programada", estilos["Heading2"])] + [Paragraph(f, corpo) for f in DIREITA]
    doc.build(historia)


# ---------------------------------------------------------------- 3. escaneado
CONTRATO = [
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS Nº 2026/0417",
    "",
    "Contratante: Fernanda Ribeiro Duarte",
    "CPF: 123.456.789-09",
    "Endereço: Rua das Acácias, 210, Belo Horizonte - MG",
    "",
    "Objeto: instalação e manutenção de internet por fibra óptica.",
    "Valor mensal: R$ 149,90",
    "Fidelidade: 12 meses a partir de 05/03/2026",
    "Multa por rescisão antecipada: proporcional aos meses restantes.",
    "",
    "Belo Horizonte, 05 de março de 2026.",
]


def gerar_escaneado():
    rnd = random.Random(7)
    largura, altura = 1654, 2339  # A4 a 200 dpi
    img = Image.new("L", (largura, altura), 250)
    d = ImageDraw.Draw(img)
    fonte = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 34)
    y = 180
    for linha in CONTRATO:
        d.text((150, y), linha, fill=25, font=fonte)
        y += 70
    for _ in range(4000):  # poeira de digitalização
        x, yy = rnd.randrange(largura), rnd.randrange(altura)
        d.point((x, yy), fill=rnd.randrange(120, 200))
    img = img.rotate(1.2, expand=False, fillcolor=250, resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.6))
    img.convert("RGB").save(AQUI / "contrato_escaneado.pdf", "PDF", resolution=200)


def gerar_gabarito():
    gabarito = {
        "relatorio_tabela.pdf": {
            "tipo": "tabela",
            "linhas": [[l[0].replace("\n", " "), *l[1:]] for l in LINHAS] + [list(TOTAL)],
        },
        "boletim_duas_colunas.pdf": {"tipo": "ordem", "frases": ESQUERDA + DIREITA},
        "contrato_escaneado.pdf": {
            "tipo": "campos",
            "campos": {
                "numero": "2026/0417",
                "contratante": "Fernanda Ribeiro Duarte",
                "cpf": "123.456.789-09",
                "valor_mensal": "R$ 149,90",
                "inicio_fidelidade": "05/03/2026",
                "cidade": "Belo Horizonte",
            },
        },
    }
    (AQUI / "gabarito.json").write_text(json.dumps(gabarito, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    gerar_tabela()
    gerar_colunas()
    gerar_escaneado()
    gerar_gabarito()
    print("Gerados:", ", ".join(sorted(p.name for p in AQUI.glob("*.pdf"))), "e gabarito.json")
