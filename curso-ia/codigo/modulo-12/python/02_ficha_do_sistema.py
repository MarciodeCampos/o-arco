"""
Lab 12.7 — Ficha do sistema de IA: o documento de governança mínimo (sem API).

Responde um questionário sobre o sistema (dados/questionario.json) e gera uma ficha
em Markdown com: classificação de risco, obrigações a verificar (LGPD, AI Act da UE,
boas práticas da ISO/IEC 42001 e do NIST AI RMF), riscos e controles.

⚠ Material didático, não é aconselhamento jurídico. Leis e regulamentos mudam:
  confirme com o jurídico e com as fontes oficiais.

    python 02_ficha_do_sistema.py
    python 02_ficha_do_sistema.py meu_questionario.json
"""
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

entrada = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "dados" / "questionario.json"
q = json.loads(entrada.read_text(encoding="utf-8"))

# ---------------------------------------------------------------- classificação de risco
# Inspirada nos níveis do AI Act da UE (proibido, alto, limitado, mínimo). As áreas de alto
# risco abaixo são um resumo didático das categorias do Anexo III; consulte o texto oficial.
AREAS_ALTO_RISCO = {
    "emprego": "recrutamento, seleção ou avaliação de trabalhadores",
    "credito": "avaliação de crédito ou pontuação de pessoas",
    "educacao": "acesso, avaliação ou vigilância de estudantes",
    "servicos_essenciais": "acesso a serviços públicos ou privados essenciais (inclui seguros de vida e saúde)",
    "biometria": "identificação ou categorização biométrica",
    "justica_e_seguranca": "segurança pública, migração, justiça",
    "infraestrutura_critica": "componentes de segurança de infraestrutura crítica",
}
area = q["area_de_aplicacao"]
if q.get("pratica_proibida"):
    nivel = "INACEITÁVEL"
elif area in AREAS_ALTO_RISCO or q["decisao_automatizada_com_efeito_juridico"]:
    nivel = "ALTO"
elif q["interage_com_pessoas"] or q["gera_conteudo_sintetico"]:
    nivel = "LIMITADO (obrigações de transparência)"
else:
    nivel = "MÍNIMO"

obrigacoes = []
# LGPD (Lei 13.709/2018)
if q["trata_dados_pessoais"]:
    obrigacoes += [
        "LGPD: base legal definida para cada finalidade (art. 7º; art. 11 para dados sensíveis)",
        "LGPD: informar o titular sobre o tratamento e a finalidade (transparência, art. 6º e 9º)",
        "LGPD: contrato de operador com o provedor do modelo; transferência internacional avaliada (art. 33)",
        "LGPD: retenção mínima de prompts e respostas; atender pedidos de acesso e exclusão",
    ]
    if q["dados_sensiveis"]:
        obrigacoes.append("LGPD: dados sensíveis exigem base legal específica e cuidado redobrado (art. 11); avaliar Relatório de Impacto (RIPD)")
if q["decisao_automatizada_com_efeito_juridico"]:
    obrigacoes.append("LGPD: direito de revisão de decisões tomadas unicamente com base em tratamento automatizado (art. 20); explicar critérios")
# AI Act (Regulamento UE 2024/1689), quando há usuários na UE
if q["usuarios_na_ue"]:
    if nivel.startswith("LIMITADO") or nivel == "ALTO":
        obrigacoes.append("AI Act: informar as pessoas de que estão interagindo com um sistema de IA; rotular conteúdo sintético")
    if nivel == "ALTO":
        obrigacoes.append("AI Act (alto risco): gestão de riscos, governança de dados, documentação técnica, registros, supervisão humana, precisão e robustez")
# Brasil
obrigacoes.append("Brasil: acompanhar o marco legal de IA (PL 2338/2023) e normas setoriais (BC, ANS, CFM, CVM...) aplicáveis ao seu setor")
# Boas práticas
obrigacoes += [
    "Boa prática (ISO/IEC 42001, NIST AI RMF): dono do sistema, inventário de modelos, avaliação antes de cada mudança, monitoramento, plano de incidentes",
]

riscos = [
    ("Alucinação gera informação errada ao usuário", "RAG com citações, abstenção, evals (Módulos 3 e 4)"),
    ("Prompt injection (direta e indireta)", "Delimitação, menor privilégio, aprovação humana, limpeza de saída (Módulo 12)"),
    ("Vazamento de dados pessoais", "Mascaramento na entrada, filtros na saída, retenção mínima de logs"),
    ("Viés: tratamento desigual entre grupos", "Avaliar o eval estratificado por grupo; revisão humana nas decisões"),
    ("Custo descontrolado", "Cotas por cliente, orçamento por tarefa, alertas (Módulos 6 e 9)"),
    ("Dependência de um fornecedor", "Interface própria, evals portáveis, plano de troca (Módulo 2)"),
]
if q["age_no_mundo"]:
    riscos.append(("Ação indevida executada por agente", "Classificação de risco das ferramentas, aprovação humana, auditoria (Módulo 6)"))

hoje = date.today().isoformat()
md = [
    f"# Ficha do sistema de IA — {q['nome']}",
    f"_Gerada em {hoje} · material didático, não é aconselhamento jurídico_\n",
    "## Identificação",
    f"- **Finalidade:** {q['finalidade']}",
    f"- **Dono (responsável):** {q['dono']}",
    f"- **Modelos usados:** {', '.join(q['modelos'])}",
    f"- **Usuários:** {q['usuarios']}",
    f"- **Área de aplicação:** {AREAS_ALTO_RISCO.get(area, area)}\n",
    f"## Classificação de risco: **{nivel}**\n",
    "## Obrigações e práticas a verificar",
    *[f"- [ ] {o}" for o in obrigacoes],
    "\n## Riscos e controles",
    "| Risco | Controle |",
    "|---|---|",
    *[f"| {r} | {c} |" for r, c in riscos],
    "\n## Supervisão humana",
    f"- {q['supervisao_humana']}",
    "\n## Revisão",
    "- Revisar esta ficha a cada troca de modelo, mudança de finalidade ou incidente.",
]
slug = re.sub(r"[^a-z0-9]+", "_", unicodedata.normalize("NFKD", q["nome"].lower()).encode("ascii", "ignore").decode()).strip("_")
saida = entrada.with_name(f"ficha_{slug}.md")
saida.write_text("\n".join(md) + "\n", encoding="utf-8")
print("\n".join(md[:12]))
print(f"... ficha completa em {saida.name} ({len(obrigacoes)} obrigações, {len(riscos)} riscos)")
