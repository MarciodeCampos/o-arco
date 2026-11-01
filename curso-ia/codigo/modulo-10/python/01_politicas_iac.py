"""
Lab 10.2 — Policy-as-code: o portão entre o "copilot de IaC" e a produção (sem API).

Um LLM gera Terraform rápido e com confiança, inclusive quando erra. O plano gerado
(dados/plano_terraform.json, no formato simplificado do `terraform show -json`) passa
por políticas escritas como código ANTES de qualquer `apply`. É o papel que OPA/Conftest,
Sentinel ou Checkov fazem em produção; aqui, em Python puro, para ver a mecânica.

    python 01_politicas_iac.py
    python 01_politicas_iac.py caminho/para/plano.json
"""
import json
import sys
from pathlib import Path

INSTANCIAS_PERMITIDAS = {"t3.micro", "t3.small", "t3.medium", "m6i.large", "m6i.xlarge"}
TAGS_OBRIGATORIAS = {"time", "centro_de_custo"}


def politicas(rc: dict) -> list[tuple[str, str]]:
    """Devolve (severidade, mensagem) para cada violação de um recurso do plano."""
    tipo, acoes = rc["type"], rc["change"]["actions"]
    depois = rc["change"].get("after") or {}
    antes = rc["change"].get("before") or {}
    v = []
    if "delete" in acoes and tipo in {"aws_db_instance", "aws_s3_bucket", "aws_dynamodb_table"}:
        v.append(("bloqueia", f"remove um recurso de DADOS ({antes.get('identifier') or antes.get('bucket')}): exige aprovação explícita e backup verificado"))
    if tipo == "aws_s3_bucket_public_access_block" and not all(depois.get(k) for k in ("block_public_acls", "block_public_policy", "ignore_public_acls", "restrict_public_buckets")):
        v.append(("bloqueia", "bucket com acesso público liberado"))
    if tipo == "aws_security_group":
        for regra in depois.get("ingress", []):
            if "0.0.0.0/0" in regra.get("cidr_blocks", []) and regra.get("from_port") in (22, 3389, 5432, 3306):
                v.append(("bloqueia", f"porta {regra['from_port']} aberta para a internet inteira"))
    if tipo == "aws_instance":
        if depois.get("instance_type") not in INSTANCIAS_PERMITIDAS:
            v.append(("bloqueia", f"tipo de instância {depois.get('instance_type')} fora da lista aprovada (custo)"))
        if depois.get("associate_public_ip_address"):
            v.append(("alerta", "instância com IP público; jobs internos não precisam"))
    if "create" in acoes and ("tags" in depois or tipo in {"aws_s3_bucket", "aws_instance"}):
        faltando = TAGS_OBRIGATORIAS - set((depois.get("tags") or {}).keys())
        if faltando:
            v.append(("alerta", f"tags obrigatórias ausentes: {', '.join(sorted(faltando))}"))
    return v


arquivo = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "dados" / "plano_terraform.json"
plano = json.loads(arquivo.read_text(encoding="utf-8"))
print(f"Plano: {plano.get('gerado_por', arquivo.name)}\n")

bloqueios = 0
for rc in plano["resource_changes"]:
    violacoes = politicas(rc)
    acao = "/".join(rc["change"]["actions"])
    print(f"{'✗' if any(s == 'bloqueia' for s, _ in violacoes) else '✓'} {acao:<7} {rc['address']}")
    for sev, msg in violacoes:
        print(f"      [{sev}] {msg}")
        bloqueios += sev == "bloqueia"

print(f"\n{bloqueios} violações bloqueantes.")
if bloqueios:
    print("Plano REPROVADO: corrija (ou devolva ao copilot com as mensagens acima) antes do apply.")
sys.exit(1 if bloqueios else 0)
