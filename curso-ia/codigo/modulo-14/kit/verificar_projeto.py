"""
Verificador do Projeto Integrador (sem API).

Confere se um projeto tem as peças que o curso exige de um sistema de IA pronto
para produção. Não avalia se o produto é bom (isso é com a banca), mas pega o que
costuma faltar na entrega.

    python verificar_projeto.py caminho/do/projeto
    python verificar_projeto.py caminho/do/projeto --json   # para usar no CI

Sai com código 1 se algum item OBRIGATÓRIO faltar.
"""
import json
import re
import sys
from pathlib import Path

IGNORAR = {"node_modules", ".git", ".venv", "venv", "__pycache__", "dist", "build", ".banco"}
SEGREDOS = re.compile(r"sk-ant-[\w-]{20,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}")


def arquivos(raiz: Path):
    for p in raiz.rglob("*"):
        if p.is_file() and not (set(p.relative_to(raiz).parts) & IGNORAR):
            yield p


def ler(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def verificar(raiz: Path) -> list[dict]:
    todos = list(arquivos(raiz))
    nomes = [str(p.relative_to(raiz)).replace("\\", "/") for p in todos]
    readme = next((ler(p) for p in todos if p.name.lower() == "readme.md" and p.parent == raiz), "")
    tem = lambda regex: any(re.search(regex, n, re.I) for n in nomes)
    conteudo_tem = lambda regex, filtro=r".": any(re.search(regex, ler(p), re.I) for p, n in zip(todos, nomes) if re.search(filtro, n))
    secoes = [s.lower() for s in re.findall(r"^#+\s+(.+)$", readme, re.M)]
    secao = lambda *chaves: any(any(c in s for c in chaves) for s in secoes)

    itens = [
        # (obrigatório?, nome, passou?, dica)
        (True, "README na raiz", bool(readme), "Crie um README.md (use kit/MODELO_README.md)"),
        (True, "README: problema e público", secao("problema", "público", "publico", "objetivo"), "Seção explicando o problema e para quem"),
        (True, "README: arquitetura", secao("arquitetura") or tem(r"arquitetura\.md$"), "Seção ou ARQUITETURA.md com o desenho"),
        (True, "README: como rodar", secao("como rodar", "instala", "execut", "começar", "comecar"), "Passo a passo para rodar localmente"),
        (True, "testes automatizados", tem(r"(\.test\.[tj]s|test_.*\.py|_test\.py)$"), "Testes que rodam sem chave de API (modelo falso ou roteirizado)"),
        (True, "dataset de avaliação (evals)", tem(r"(evals?|avaliacao|casos)/.*\.(jsonl|json|csv)$") or tem(r"(casos|perguntas|cenarios).*\.jsonl$"), "Casos com gabarito (Módulo 3)"),
        (True, "sem segredos no repositório", not any(SEGREDOS.search(ler(p)) for p in todos), "Remova chaves e revogue-as; use variáveis de ambiente"),
        (True, "sem .env versionado", not tem(r"(^|/)\.env$"), "Adicione .env ao .gitignore"),
        (False, ".env.example documentando variáveis", tem(r"\.env\.example$"), "Liste as variáveis necessárias, sem valores reais"),
        (False, "CI configurado", tem(r"\.github/workflows/.*\.ya?ml$|\.gitlab-ci\.yml$"), "Testes e evals rodando a cada PR (Módulos 3 e 7)"),
        (False, "prompts versionados fora do código", tem(r"prompts?/") or conteudo_tem(r"versao.?prompt|prompt.?version", r"\.(ts|py|json)$"), "Prompts em arquivos versionados (Módulo 9)"),
        (False, "registro de custo/uso", conteudo_tem(r"usage|custo|tokens", r"\.(ts|py)$"), "Registre tokens e custo por requisição (Módulos 2 e 9)"),
        (False, "ficha de governança / segurança", tem(r"(ficha|seguranca|security|governanca).*\.md$") or secao("segurança", "seguranca", "privacidade"), "Ficha do sistema e riscos (Módulo 12)"),
        (False, "arquivo de contexto para agentes", tem(r"(^|/)(CLAUDE|AGENTS)\.md$"), "Instruções para agentes de código (Módulo 7)"),
        (False, "README: evals e resultados", secao("avalia", "eval", "resultado", "métrica", "metrica"), "Mostre a qualidade medida, com números"),
        (False, "README: custos", secao("custo"), "Custo por tarefa e projeção mensal"),
    ]
    return [{"obrigatorio": o, "item": n, "ok": bool(ok), "dica": d} for o, n, ok, d in itens]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("uso: python verificar_projeto.py caminho/do/projeto [--json]")
    raiz = Path(sys.argv[1]).resolve()
    resultado = verificar(raiz)
    falta_obrigatorio = [r for r in resultado if r["obrigatorio"] and not r["ok"]]
    if "--json" in sys.argv:
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
    else:
        print(f"Projeto: {raiz.name}\n")
        for r in resultado:
            marca = "✓" if r["ok"] else ("✗" if r["obrigatorio"] else "·")
            print(f"  {marca} {r['item']}{'' if r['ok'] else f'  → {r['dica']}'}")
        ok = sum(r["ok"] for r in resultado)
        print(f"\n{ok}/{len(resultado)} itens · obrigatórios faltando: {len(falta_obrigatorio)}")
    sys.exit(1 if falta_obrigatorio else 0)
