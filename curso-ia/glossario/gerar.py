"""
Gera glossario/index.html a partir dos dados abaixo.

    python3 curso-ia/glossario/gerar.py

Fonte: documentação oficial do Claude Code (code.claude.com/docs), consultada em
novembro de 2026 com o Claude Code 2.1.316. Ao atualizar, confira cada termo na
página oficial correspondente.
"""
import html
import pathlib
import re
import unicodedata

DOCS = "https://code.claude.com/docs/pt/"

# (termo, nome em inglês ou "", definição, módulo da trilha, página da documentação)
TERMOS = [
    ("Agent SDK", "Claude Agent SDK", "Biblioteca em TypeScript e Python que dá aos seus programas o mesmo motor do Claude Code: ciclo agêntico, ferramentas, permissões, hooks e sessões.", 8, "agent-sdk/overview"),
    ("AGENTS.md", "", "Arquivo de instruções para agentes de código, padrão aberto. Se o repositório tem AGENTS.md e não tem CLAUDE.md, o Claude Code o lê como instruções do projeto.", 3, "memory"),
    ("Agente", "agent", "Sistema em que o modelo decide quais ferramentas usar e em que ordem, observando o resultado de cada passo até concluir a tarefa. O Claude Code é um agente de código.", 1, "how-claude-code-works"),
    ("Artefato", "artifact", "Página web privada e interativa que o Claude publica no claude.ai a partir da sessão, para você ver ou compartilhar um resultado visual em vez de ler texto no terminal.", 2, "artifacts"),
    ("Autonomia (escada da)", "", "Termo do curso para a sequência de modos de permissão, do mais supervisionado ao mais livre: manual, acceptEdits, plano, auto, dontAsk e bypassPermissions. Subir na escada exige barreiras proporcionais.", 4, "permission-modes"),
    ("Bare (modo)", "bare mode", "Flag --bare: inicia sem carregar hooks, skills, plugins, servidores MCP, memória automática nem CLAUDE.md. Recomendado em CI, para o resultado ser igual em qualquer máquina.", 7, "headless"),
    ("bypassPermissions", "", "Modo de permissão que pula todas as checagens (flag --dangerously-skip-permissions). Só para contêineres e máquinas virtuais isolados, como usuário sem privilégios de root. Regras deny continuam valendo.", 4, "permission-modes"),
    ("Canal", "channel", "Servidor MCP que empurra eventos (mensagens, alertas, webhooks) para uma sessão em andamento, para o Claude reagir enquanto você está longe do terminal.", 6, "channels"),
    ("Checkpoint", "", "Ponto de restauração criado a cada mensagem sua. Esc duas vezes ou /rewind volta o código, a conversa ou ambos. Não desfaz o que um comando de terminal mudou fora das ferramentas de edição.", 2, "checkpointing"),
    ("Ciclo agêntico", "agentic loop", "O ciclo que o Claude repete em toda tarefa: coletar contexto, agir, verificar o resultado e repetir até terminar. Você pode interromper a qualquer momento.", 2, "how-claude-code-works"),
    ("Classificador do modo auto", "", "Modelo separado que revisa cada ação no modo auto e bloqueia o que for irreversível, destrutivo, fora do escopo ou induzido por prompt injection. Não vê o resultado das ferramentas, para não ser manipulado por ele.", 4, "permission-modes"),
    ("CLAUDE.md", "", "Arquivo de instruções permanentes que você escreve para o Claude: convenções, comandos de teste, regras do tipo \"sempre faça X\". Carregado no início de toda sessão e relido do disco após a compactação.", 3, "memory"),
    ("claude -p", "print / non-interactive mode", "Modo não interativo: executa um único pedido e sai. Base para scripts, CI e pipelines. Aceita --output-format json, --json-schema, --max-turns e --max-budget-usd.", 7, "headless"),
    ("Code Review", "", "Serviço que revisa automaticamente cada pull request no GitHub com vários agentes. No terminal, o equivalente local é /code-review; ultrareview faz uma revisão mais profunda na nuvem.", 7, "code-review"),
    ("Compactação", "compaction", "Resumo automático da conversa quando a janela de contexto enche. O CLAUDE.md da raiz e a memória automática sobrevivem; instruções dadas só na conversa podem se perder. /compact força a compactação.", 2, "context-window"),
    ("Comando de barra", "slash command", "Instrução reutilizável chamada com /nome, como /clear, /model e /compact. Comandos próprios hoje são feitos como skills.", 2, "commands"),
    ("Conector", "connector", "Servidor MCP adicionado à sua conta do claude.ai (Gmail, Drive, Slack…). Aparece no /mcp do Claude Code quando você entra com a mesma conta.", 5, "mcp"),
    ("Contexto (janela de)", "context window", "A memória de trabalho da sessão: conversa, arquivos lidos, saídas de comandos, CLAUDE.md, skills e instruções do sistema. /context mostra o que ocupa espaço.", 1, "context-window"),
    ("Dev container", "", "Contêiner de desenvolvimento configurado no repositório. Dá isolamento consistente para rodar o Claude com mais autonomia sem expor sua máquina.", 4, "devcontainer"),
    ("Dispatch", "", "Envio de uma tarefa pelo app do celular que abre uma sessão do Claude Code no app desktop.", 6, "desktop"),
    ("dontAsk", "", "Modo de permissão em que só rodam leituras e ferramentas pré-aprovadas; o que pediria permissão é negado. Ideal para CI com lista exata do que pode.", 7, "permission-modes"),
    ("Esforço (nível de)", "effort level", "Quanto o modelo raciocina em cada passo: low, medium, high, xhigh ou max. Mais esforço, respostas mais cuidadosas, mais lentas e mais caras. /effort ou --effort.", 2, "model-config"),
    ("Estilo de saída", "output style", "Configuração que muda o papel, o tom e o formato das respostas em toda a sessão, inclusive para usar o Claude em tarefas que não são de programação.", 3, "output-styles"),
    ("Equipe de agentes", "agent teams", "Várias sessões do Claude Code coordenadas por uma líder, com lista de tarefas compartilhada e mensagens entre elas. Experimental, desligada por padrão.", 6, "agent-teams"),
    ("Ferramenta", "tool", "Uma ação que o Claude pode executar: ler arquivo, editar, rodar comando, buscar na web, criar subagente. É o que transforma o modelo em agente.", 2, "tools-reference"),
    ("Fluxo dinâmico", "dynamic workflow", "Script que o Claude escreve para orquestrar muitos subagentes em segundo plano, por exemplo para auditar um código inteiro com verificação cruzada.", 6, "workflows"),
    ("Frontmatter", "", "Bloco YAML entre linhas --- no topo de um arquivo Markdown. Skills, subagentes, estilos de saída e regras leem sua configuração dali.", 5, "skills"),
    ("GitHub Actions (Claude Code)", "", "Integração que roda o Claude Code em workflows do GitHub: responder a menções em issues e PRs, corrigir CI, revisar código. /install-github-app configura.", 7, "github-actions"),
    ("/goal", "", "Define uma condição de conclusão; o Claude continua trabalhando até que ela seja verdadeira.", 6, "goal"),
    ("Harness", "agentic harness", "As ferramentas, o gerenciamento de contexto e o ambiente de execução que transformam um modelo em agente. O Claude Code é o harness; o Claude é o modelo dentro dele.", 1, "how-claude-code-works"),
    ("Hook", "", "Ação que roda automaticamente em um ponto do ciclo de vida (antes de uma ferramenta, depois de uma edição, no início da sessão). Pode ser comando, HTTP, ferramenta MCP, prompt ou subagente. Determinístico: não depende da vontade do modelo.", 5, "hooks-guide"),
    ("Injeção de prompt", "prompt injection", "Instruções hostis escondidas em arquivos, páginas ou resultados de ferramentas, que tentam desviar o agente. A principal razão para não dar autonomia sem barreiras.", 4, "security"),
    ("Inteligência de código", "code intelligence / LSP", "Plugin que conecta o Claude a um servidor de linguagem, para navegar por símbolos e ver erros de tipo sem ler arquivos inteiros.", 5, "plugins/code-intelligence"),
    ("/loop", "", "Skill que repete um pedido em intervalos durante a sessão, por exemplo para acompanhar um deploy ou um PR.", 6, "scheduled-tasks"),
    ("Managed settings", "configurações gerenciadas", "Configurações impostas pela organização, que usuários e projetos não podem sobrescrever. Usadas para regras de segurança de toda a empresa.", 8, "managed-settings"),
    ("Marketplace", "", "Catálogo de plugins, definido por um marketplace.json, de onde se instalam plugins com /plugin ou claude plugin install.", 5, "plugins/overview"),
    ("MCP", "Model Context Protocol", "Padrão aberto para conectar a IA a ferramentas e dados externos: bancos, Slack, Jira, navegador e centenas de outros. Visto em profundidade no Módulo 5 do curso principal.", 5, "mcp"),
    ("MCP Tool Search", "", "Mecanismo que carrega só os nomes das ferramentas MCP no início e busca o esquema completo quando for usar, para muitos servidores não lotarem o contexto.", 5, "mcp"),
    ("Memória automática", "auto memory", "Notas que o Claude escreve para si mesmo a partir das suas correções e preferências, guardadas por repositório. Contraparte do CLAUDE.md, que é você quem escreve.", 3, "memory"),
    ("Mod", "", "Plugin que altera a própria interface e o comportamento do Claude Code: painéis, faixas, comandos e regras sobre chamadas de ferramentas.", 5, "plugins/mods/overview"),
    ("Modelo de linguagem", "LLM", "Programa treinado em muito texto para prever a continuação mais provável. Com ferramentas, passa a agir; sem verificação, pode errar com confiança.", 1, ""),
    ("Modo auto", "auto mode", "Modo de permissão em que o classificador revisa as ações no seu lugar, e o Claude roda a maioria sem perguntar. É o modo inicial padrão nas versões atuais do terminal e do VS Code.", 4, "permission-modes"),
    ("Modo manual", "default", "Modo de permissão que pede aprovação para tudo que não é leitura. Valor de configuração: default.", 4, "permission-modes"),
    ("Modo plano", "plan mode", "Modo em que o Claude pesquisa e propõe um plano sem editar seus arquivos. /plan ou Shift+Tab.", 2, "permission-modes"),
    ("acceptEdits", "", "Modo de permissão que aprova edições de arquivos e comandos simples de arquivo (mkdir, mv, cp) sem perguntar.", 4, "permission-modes"),
    ("Plugin", "", "Pacote instalável com skills, hooks, subagentes e servidores MCP. Suas skills ganham prefixo (plugin:skill) para coexistir.", 5, "plugins/overview"),
    ("Projeto (confiança no)", "project trust", "Diálogo em que você aceita uma pasta antes de o Claude Code carregar a configuração dela. Até lá, regras allow e marketplaces do repositório ficam retidos.", 4, "claude-directory"),
    ("Regras", "rules", "Arquivos em .claude/rules/ carregados junto com o CLAUDE.md. Podem valer só para certos caminhos (frontmatter paths:), economizando contexto.", 3, "memory"),
    ("Regra de permissão", "permission rule", "Entrada allow, ask ou deny no settings.json, como Bash(npm test) ou Read(./.env). Avaliadas na ordem deny, ask, allow; vale a primeira que bater. Deny vale em todos os modos.", 4, "permissions"),
    ("Remote Control", "", "Continuar uma sessão local pelo celular ou navegador. O código continua rodando na sua máquina; só a interface é remota.", 6, "remote-control"),
    ("Remoção crítica", "critical-path removal", "rm ou rmdir em caminhos críticos (raiz, home, pastas do sistema). Nenhum modo aprova sozinho, nem bypassPermissions por padrão.", 4, "permission-modes"),
    ("Rotina / tarefa agendada", "scheduled task", "Pedido que roda sozinho em horário definido, na nuvem (/schedule) ou no app desktop. Antes chamado de routine.", 7, "routines"),
    ("Sandbox", "sandboxing", "Isolamento de arquivos e rede no nível do sistema operacional para os comandos de terminal. Dentro do limite definido, o Claude trabalha sem pedir permissão a cada comando. /sandbox liga.", 4, "sandboxing"),
    ("Sessão", "session", "Uma conversa ligada a uma pasta, com contexto próprio. claude -c continua a última; /resume escolhe; /clear começa outra.", 2, "sessions"),
    ("Sessão em segundo plano", "background session", "Sessão que roda sem ocupar o terminal: claude --bg ou /background. claude agents lista, attach abre, stop para.", 6, "agent-view"),
    ("Sessão na nuvem", "cloud session", "Sessão que roda na infraestrutura da Anthropic (ou da sua empresa) e continua com o notebook fechado. Começa de um clone novo do repositório.", 6, "claude-code-on-the-web"),
    ("settings.json (camadas)", "settings layers", "Configuração em camadas, da mais forte para a mais fraca: gerenciada, flag --settings, .claude/settings.local.json, .claude/settings.json e ~/.claude/settings.json. Listas se somam; valores simples da camada mais forte vencem.", 3, "settings"),
    ("Skill", "", "Arquivo SKILL.md com instruções, conhecimento ou um procedimento. O Claude carrega quando é relevante, ou você chama com /nome. Segue o padrão aberto Agent Skills.", 5, "skills"),
    ("Skills embutidas", "bundled skills", "Skills que já vêm no Claude Code, como /batch, /code-review, /debug, /loop, /run, /simplify e /fewer-permission-prompts.", 5, "skills"),
    ("Subagente", "subagent", "Assistente especializado com contexto, prompt, ferramentas e permissões próprios. Faz uma tarefa delegada e devolve um resumo. Embutidos: Explore, Plan e general-purpose.", 5, "sub-agents"),
    ("Superfície", "surface", "Onde você usa o Claude Code: terminal, VS Code, JetBrains, app desktop, claude.ai, celular. Todas usam o mesmo motor.", 1, "platforms"),
    ("System prompt", "", "Instruções que o Claude Code envia antes da conversa em todo pedido. Pode ser complementado com --append-system-prompt.", 3, "cli-reference"),
    ("System reminder", "", "Mensagem que o harness insere na conversa para dar contexto: seu CLAUDE.md, a lista de skills, o texto de um hook, o aviso de que um arquivo mudou.", 3, "glossary"),
    ("Teleport", "", "/teleport traz uma sessão da nuvem para o seu terminal, com a branch e a conversa. O caminho inverso é --cloud.", 6, "claude-code-on-the-web"),
    ("Token", "", "Pedaço de texto (em média, parte de uma palavra) que o modelo lê e escreve. Contexto, limites e preço são medidos em tokens.", 1, ""),
    ("Transcrição", "transcript", "Registro guardado de uma sessão: mensagens, chamadas de ferramentas e resultados. Permite retomar e auditar o que o agente fez.", 2, "sessions"),
    ("Turno", "turn", "Uma rodada: sua mensagem e tudo que o Claude faz até devolver a vez.", 2, "glossary"),
    ("Verificação (ciclo de)", "verification loop", "Dar ao Claude um jeito de conferir o próprio trabalho (testes, build, captura de tela) para ele corrigir sozinho até passar. A prática que mais aumenta a qualidade com autonomia.", 2, "best-practices"),
    ("Worktree", "", "Cópia de trabalho separada do mesmo repositório git. Permite várias sessões em paralelo sem uma sobrescrever a outra. claude -w cria uma.", 6, "worktrees"),
    ("autoMode.environment", "", "Configuração que diz ao classificador do modo auto quais repositórios, domínios, buckets e serviços são confiáveis. Lida do settings do usuário ou da organização, nunca do repositório.", 4, "auto-mode-config"),
    (".mcp.json", "", "Arquivo do projeto com os servidores MCP compartilhados pelo time. Cada pessoa aprova os servidores antes de eles conectarem.", 5, "mcp"),
]

# Mapa de componentes: (camada, [(componente, para que serve, onde fica / como usar, módulo)])
MAPA = [
    ("Modelo e superfícies", [
        ("Modelos Fable, Opus, Sonnet, Haiku", "O cérebro. Maior = mais capaz e mais caro", "/model, --model, \"model\" no settings", 1),
        ("Superfícies", "Onde você trabalha: terminal, IDE, desktop, web, celular", "claude (CLI), extensões, claude.ai/code", 1),
        ("Esforço", "Quanto raciocinar por passo", "/effort, --effort", 2),
    ]),
    ("Contexto e memória", [
        ("CLAUDE.md / AGENTS.md", "Instruções permanentes do projeto e suas", "./CLAUDE.md, ~/.claude/CLAUDE.md", 3),
        ("Regras", "Instruções por caminho de arquivo", ".claude/rules/*.md", 3),
        ("Memória automática", "O Claude anota suas preferências", "/memory", 3),
        ("Estilo de saída", "Tom e formato das respostas", "/output-style", 3),
    ]),
    ("Permissões e isolamento", [
        ("Modos de permissão", "Quanto o Claude pode fazer sem perguntar", "Shift+Tab, --permission-mode, permissions.defaultMode", 4),
        ("Regras allow/ask/deny", "Liberar, confirmar ou proibir ações específicas", "/permissions, \"permissions\" no settings", 4),
        ("Sandbox", "Cerca de arquivos e rede para comandos", "/sandbox, \"sandbox\" no settings", 4),
        ("Modo auto + autoMode", "Classificador no lugar do clique", "--permission-mode auto, \"autoMode\" em ~/.claude/settings.json", 4),
        ("Contêiner / nuvem", "Isolamento total para autonomia máxima", "dev container, sessão na nuvem", 4),
    ]),
    ("Extensões", [
        ("Servidores MCP", "Ferramentas e dados externos", "claude mcp add, .mcp.json, /mcp", 5),
        ("Skills", "Procedimentos e conhecimento reutilizáveis", ".claude/skills/<nome>/SKILL.md, /skills", 5),
        ("Subagentes", "Trabalhadores com contexto isolado", ".claude/agents/*.md, /agents", 5),
        ("Hooks", "Ações automáticas em eventos", "\"hooks\" no settings, /hooks", 5),
        ("Plugins e marketplaces", "Empacotar e distribuir tudo isso", "/plugin, claude plugin install", 5),
        ("LSP, linha de status, atalhos", "Conforto e precisão no dia a dia", "plugins de linguagem, /statusline, /keybindings", 5),
    ]),
    ("Paralelismo e trabalho remoto", [
        ("Worktrees", "Várias tarefas sem conflito", "claude -w, /fork", 6),
        ("Segundo plano", "Sessões que não prendem o terminal", "claude --bg, claude agents, /background", 6),
        ("Equipes e fluxos", "Muitos agentes coordenados", "agent teams, Workflow", 6),
        ("Metas e laços", "Trabalhar até concluir ou em intervalos", "/goal, /loop", 6),
        ("Nuvem, Remote Control, celular", "Acompanhar e dirigir de longe", "--cloud, /remote-control, /teleport", 6),
    ]),
    ("Automação, testes e implantação", [
        ("Modo não interativo", "Rodar em scripts e CI", "claude -p, --output-format json, --json-schema", 7),
        ("Limites", "Teto de custo e de passos", "--max-budget-usd, --max-turns", 7),
        ("GitHub Actions / GitLab CI", "Claude no pipeline", "/install-github-app, anthropics/claude-code-action", 7),
        ("Revisão de código", "Achar bugs antes do merge", "/code-review, /security-review, Code Review, ultrareview", 7),
        ("Tarefas agendadas", "Trabalho recorrente sem você", "/schedule, /loop", 7),
    ]),
    ("Plataforma e governança", [
        ("Agent SDK", "O motor do Claude Code nos seus produtos", "@anthropic-ai/claude-agent-sdk, claude-agent-sdk (Python)", 8),
        ("Custos e uso", "Saber quanto gasta e onde", "/usage, OpenTelemetry", 8),
        ("Managed settings", "Regras de toda a empresa", "managed-settings.json, console de administração", 8),
    ]),
]

ARQUIVOS = [
    ("~/.claude/settings.json", "Suas configurações, valem em todos os projetos (inclui autoMode)"),
    (".claude/settings.json", "Configurações do projeto, versionadas para o time"),
    (".claude/settings.local.json", "Suas configurações neste projeto, fora do git"),
    ("managed-settings.json", "Configurações da organização, não podem ser sobrescritas"),
    ("CLAUDE.md, .claude/CLAUDE.md, ~/.claude/CLAUDE.md", "Instruções do projeto e suas"),
    (".claude/rules/*.md", "Regras modulares, com escopo por caminho"),
    (".claude/skills/<nome>/SKILL.md, ~/.claude/skills/", "Skills do projeto e suas"),
    (".claude/agents/*.md, ~/.claude/agents/", "Subagentes do projeto e seus"),
    (".claude/commands/*.md", "Comandos no formato antigo (continuam funcionando)"),
    (".mcp.json", "Servidores MCP do projeto"),
    ("~/.claude.json", "Estado local e servidores MCP de escopo local e de usuário"),
    ("~/.claude/projects/", "Transcrições e memória automática por projeto"),
    (".claude-plugin/plugin.json", "Manifesto de um plugin"),
    (".claude-plugin/marketplace.json", "Catálogo de um marketplace de plugins"),
]

COMANDOS = [
    ("/init", "Cria um CLAUDE.md a partir do seu projeto"), ("/doctor", "Diagnostica instalação e configuração"),
    ("/model, /effort", "Troca o modelo e o nível de esforço"), ("/context", "Mostra o que ocupa o contexto"),
    ("/compact", "Resume a conversa para liberar contexto"), ("/clear", "Começa uma conversa nova"),
    ("/resume, /rename, /branch", "Retoma, nomeia ou ramifica sessões"), ("/rewind", "Volta código e conversa a um checkpoint"),
    ("/plan", "Entra no modo plano"), ("/permissions", "Gerencia regras allow, ask e deny"),
    ("/sandbox", "Liga o sandbox de comandos"), ("/auto-mode-setup", "Rascunha a configuração de ambiente do modo auto"),
    ("/fewer-permission-prompts", "Sugere regras allow a partir do seu histórico"), ("/memory", "Edita CLAUDE.md e memória automática"),
    ("/mcp", "Conecta e autentica servidores MCP"), ("/skills, /agents, /hooks, /plugin", "Gerencia extensões"),
    ("/code-review, /security-review", "Revisa as mudanças da branch"), ("/goal, /loop, /schedule", "Trabalho até concluir, em laço ou agendado"),
    ("/background, /tasks", "Segundo plano e tarefas em andamento"), ("/usage", "Consumo e limites"),
    ("/diff, /export", "Revisa mudanças, exporta a conversa"), ("/install-github-app", "Configura o app e as Actions do GitHub"),
]

FERRAMENTAS = [
    ("Read, Edit, Write, NotebookEdit", "Ler e alterar arquivos"), ("Glob, Grep", "Encontrar arquivos e textos"),
    ("Bash, PowerShell, Monitor", "Rodar comandos; Monitor acompanha a saída em segundo plano"),
    ("WebFetch, WebSearch", "Buscar na web"), ("Agent, SendMessage, ListAgents", "Criar subagentes e conversar com outras sessões"),
    ("Skill, ToolSearch", "Usar skills e carregar ferramentas sob demanda"), ("EnterPlanMode, ExitPlanMode, AskUserQuestion", "Planejar e perguntar a você"),
    ("EnterWorktree, ExitWorktree", "Isolar trabalho em worktree"), ("TaskCreate, TaskUpdate, TaskList, TaskGet, TaskStop", "Lista de tarefas e tarefas em segundo plano"),
    ("CronCreate, CronList, CronDelete, RemoteTrigger", "Agendamentos"), ("LSP", "Inteligência de código"),
    ("Workflow", "Fluxos dinâmicos com muitos subagentes"), ("Artifact, SendUserFile, PushNotification", "Publicar páginas, enviar arquivos, notificar"),
]

HOOKS = [
    ("SessionStart / SessionEnd", "Início e fim da sessão: preparar ambiente, registrar"),
    ("UserPromptSubmit", "Antes de o Claude ler seu pedido: adicionar contexto, bloquear"),
    ("PreToolUse", "Antes de uma ferramenta rodar: pode bloquear (a barreira mais usada)"),
    ("PermissionRequest / PermissionDenied", "Quando uma ação pede permissão ou é negada pelo modo auto"),
    ("PostToolUse / PostToolUseFailure", "Depois de uma ferramenta: formatar, rodar lint, registrar"),
    ("Stop / StopFailure", "Quando o Claude termina ou falha por erro de API: checar se testes passam"),
    ("SubagentStart / SubagentStop", "Início e fim de subagentes"),
    ("PreCompact / PostCompact", "Antes e depois da compactação"),
    ("Notification", "Quando o Claude Code notifica (por exemplo, esperando permissão)"),
    ("ConfigChange, FileChanged, CwdChanged, InstructionsLoaded", "Mudanças de configuração, arquivos, pasta e instruções"),
    ("WorktreeCreate / WorktreeRemove, TaskCreated / TaskCompleted", "Worktrees e tarefas"),
]

ORDEM = [
    ("O Claude errou uma convenção ou um comando duas vezes", "Escreva no CLAUDE.md"),
    ("Você sempre pede o mesmo formato de resposta", "Defina um estilo de saída"),
    ("Você digita o mesmo pedido para começar uma tarefa", "Crie uma skill que você chama com /nome"),
    ("Você cola o mesmo procedimento pela terceira vez", "Transforme em skill"),
    ("Você copia dados de um sistema que o Claude não vê", "Conecte esse sistema por MCP"),
    ("O Claude lê muitos arquivos para achar um símbolo", "Instale o plugin de inteligência de código da linguagem"),
    ("Uma tarefa lateral enche a conversa de saída", "Mande para um subagente"),
    ("Algo precisa acontecer sempre, sem pedir", "Escreva um hook"),
    ("Os pedidos de permissão estão atrapalhando", "Rode /fewer-permission-prompts, ligue o sandbox ou use o modo auto (Módulo P4)"),
    ("Um segundo repositório precisa do mesmo ambiente", "Empacote como plugin"),
]


def e(s):
    return html.escape(s, quote=False)


def letra(t):
    c = unicodedata.normalize("NFD", t.lstrip("/.").upper())[0]
    return c if c.isalpha() else "#"


def slug(t):
    t = unicodedata.normalize("NFD", t.lower()).encode("ascii", "ignore").decode()
    return "t-" + re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def link(pagina):
    return f' <a href="{DOCS}{pagina}" target="_blank" rel="noopener">documentação</a>' if pagina else ""


def tabela(cab, linhas):
    th = "".join(f"<th>{e(c)}</th>" for c in cab)
    trs = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in l) + "</tr>" for l in linhas)
    return f"<table>\n<tr>{th}</tr>\n{trs}\n</table>"


PRONTOS = {m["numero"] for m in __import__("json").loads(
    (pathlib.Path(__file__).parent.parent / "curriculo.json").read_text(encoding="utf-8"))["preliminares"]
    if m["status"] == "pronto"}


def pre(n):
    """Liga para o módulo só quando ele já está publicado; rode de novo ao publicar um módulo."""
    return f'<a href="../pre-{n:02d}/">P{n}</a>' if n in PRONTOS else f"P{n}"


termos = sorted(TERMOS, key=lambda x: unicodedata.normalize("NFD", x[0].lstrip("/.").lower()))
grupos: dict[str, list] = {}
for t in termos:
    grupos.setdefault(letra(t[0]), []).append(t)

gloss = []
for L, ts in grupos.items():
    itens = "\n".join(
        f'<dt id="{slug(t)}">{e(t)}{f" <small>({e(en)})</small>" if en else ""}</dt>'
        f"<dd>{e(d)} <small>Módulo {pre(m)}.{link(pg)}</small></dd>"
        for t, en, d, m, pg in ts
    )
    gloss.append(f"<h3>{L}</h3>\n<dl>\n{itens}\n</dl>")

mapa = "\n".join(
    f"<h3>{e(camada)}</h3>\n" + tabela(["Componente", "Para que serve", "Onde fica / como usar", "Módulo"],
                                        [[f"<strong>{e(c)}</strong>", e(p), f"<code>{e(o)}</code>", pre(m)] for c, p, o, m in itens])
    for camada, itens in MAPA
)

pagina = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#050508">
<meta name="description" content="Mapa de componentes e glossário do Claude e do Claude Code: modelos, superfícies, permissões, sandbox, modo auto, MCP, skills, subagentes, hooks, plugins, automação e governança.">
<title>Mapa e glossário do Claude — Engenharia de IA Aplicada</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/curso.css">
</head>
<body>
<header class="topbar">
  <a class="brand" href="/">◈ TRIADIC.LIFE</a>
  <span class="crumbs">/ <a href="../">Engenharia de IA</a> / Mapa e glossário</span>
  <span class="spacer"></span>
</header>
<div class="layout">
  <aside class="toc">
    <button class="toc-toggle" type="button">☰ Nesta página</button>
    <h2>Referência</h2>
    <nav><ol>
      <li><a href="#inicio">Visão geral</a></li>
      <li><a href="#mapa">Mapa de componentes</a></li>
      <li><a href="#ordem">O que adicionar, e quando</a></li>
      <li><a href="#arquivos">Arquivos e locais</a></li>
      <li><a href="#comandos">Comandos essenciais</a></li>
      <li><a href="#ferramentas">Ferramentas embutidas</a></li>
      <li><a href="#hooks">Eventos de hook</a></li>
      <li><a href="#glossario">Glossário A–Z</a></li>
    </ol></nav>
  </aside>
  <main class="content">
    <section id="inicio">
      <header><div class="eyebrow">Trilha preliminar · referência</div><h1>Mapa de componentes e glossário do Claude</h1></header>
      <p class="lede">
        Tudo o que aparece na trilha preliminar, num lugar só: as peças que compõem um ambiente produtivo com
        o Claude, quando vale adicionar cada uma, os arquivos onde ficam e o significado de cada termo.
        Volte aqui sempre que uma palavra nova aparecer.
      </p>
      <div class="callout"><b>Fonte e data</b>Baseado na documentação oficial do Claude Code e na versão 2.1.316, em novembro de 2026. O produto muda toda semana: na dúvida, a <a href="{DOCS}overview" target="_blank" rel="noopener">documentação oficial em português</a> vale mais do que esta página. Para conceitos de modelo (tokens, temperatura, RAG), veja também o <a href="https://platform.claude.com/docs/pt-BR/about-claude/glossary" target="_blank" rel="noopener">glossário da plataforma</a>.</div>
    </section>

    <section id="mapa">
      <h2>Mapa de componentes</h2>
      <p>Da base para o topo: cada camada depende das de baixo. Quem está começando precisa das três primeiras; autonomia em testes e implantações usa todas.</p>
{mapa}
    </section>

    <section id="ordem">
      <h2>O que adicionar, e quando</h2>
      <p>Não configure tudo no primeiro dia. A documentação oficial recomenda adicionar cada peça quando aparecer o sinal certo:</p>
{tabela(["Sinal", "O que adicionar"], [[e(a), e(b)] for a, b in ORDEM])}
    </section>

    <section id="arquivos">
      <h2>Arquivos e locais</h2>
      <p><code>~</code> é a sua pasta pessoal; caminhos sem <code>~</code> são relativos à raiz do projeto.</p>
{tabela(["Arquivo ou pasta", "O que guarda"], [[f"<code>{e(a)}</code>", e(b)] for a, b in ARQUIVOS])}
    </section>

    <section id="comandos">
      <h2>Comandos essenciais</h2>
      <p>Digite <code>/</code> no Claude Code para ver todos. Estes são os que a trilha usa:</p>
{tabela(["Comando", "O que faz"], [[f"<code>{e(a)}</code>", e(b)] for a, b in COMANDOS])}
    </section>

    <section id="ferramentas">
      <h2>Ferramentas embutidas</h2>
      <p>São os nomes que aparecem nas regras de permissão, como <code>Bash(npm test)</code> ou <code>Edit</code>.</p>
{tabela(["Ferramenta", "Para que serve"], [[f"<code>{e(a)}</code>", e(b)] for a, b in FERRAMENTAS])}
    </section>

    <section id="hooks">
      <h2>Eventos de hook</h2>
      <p>Os principais pontos do ciclo de vida em que um hook pode rodar. A lista completa está na <a href="{DOCS}hooks" target="_blank" rel="noopener">referência de hooks</a>.</p>
{tabela(["Evento", "Quando e para quê"], [[f"<code>{e(a)}</code>", e(b)] for a, b in HOOKS])}
    </section>

    <section id="glossario" class="glossario">
      <h2>Glossário A–Z</h2>
      <p><label for="filtro-glossario">Filtrar termos:</label> <input id="filtro-glossario" type="search" placeholder="ex.: permissão, hook, nuvem" autocomplete="off"> <small id="filtro-contador" aria-live="polite"></small></p>
{chr(10).join(gloss)}
      <nav class="pager">
        <a href="../"><small>← Voltar</small>Todos os módulos</a>
        <a class="next" href="../pre-01/"><small>Começar a trilha →</small>P1 · IA sem mistério</a>
      </nav>
    </section>
  </main>
</div>
<footer class="foot"><a href="/">triadic.life</a> · <a href="../">Engenharia de IA Aplicada</a></footer>
<script src="../assets/curso.js"></script>
<script src="filtro.js"></script>
</body>
</html>
"""
saida = pathlib.Path(__file__).with_name("index.html")
saida.write_text(pagina, encoding="utf-8")
print(f"{saida}: {len(TERMOS)} termos, {sum(len(i) for _, i in MAPA)} componentes")
