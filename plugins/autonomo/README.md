# autonomo · Claude trabalhando sozinho, com segurança

Plugin do Claude Code que ensina o Claude a preparar o computador de qualquer pessoa, inclusive quem
nunca usou IA ou terminal, e a trabalhar com autonomia dentro de barreiras de segurança testadas. O
Claude explica cada passo em linguagem simples, dá links diretos e pede aprovação nas decisões
importantes.

## Instalar

Com o Claude Code já instalado ([como instalar](https://code.claude.com/docs/pt/quickstart)):

```bash
claude plugin marketplace add MarciodeCampos/o-arco
```

```bash
claude plugin install autonomo@o-arco
```

Depois abra o Claude Code (`claude`) e digite:

```
/autonomo:comecar
```

## Skills

| Comando | O que faz |
|---|---|
| `/autonomo:comecar` | Do zero ao primeiro projeto: diagnóstico, instalação do que falta, GitHub, autonomia e projeto |
| `/autonomo:diagnostico` | Mostra o que está instalado e o que falta, sem alterar nada |
| `/autonomo:configurar-autonomia` | Escolhe e aplica o nível de autonomia (0 a 3), com backup e validação |
| `/autonomo:verificar-barreiras` | Prova com testes inofensivos que segredos e ações destrutivas estão bloqueados |
| `/autonomo:ideias` | Conversa sobre o seu ramo de atividade, sugere ferramentas e sistemas que podem melhorar o negócio e transforma a ideia escolhida em requisitos |
| `/autonomo:novo-projeto` | Cria um projeto com git, testes, proteção de segredos, GitHub e CI, e desenvolve a primeira versão |
| `/autonomo:mapear-projetos` | Encontra os projetos que você já tem no computador e no GitHub, onde estão publicados e como se conectam, e gera o `projetos.json` |
| `/autonomo:central` | Transforma a pasta do `projetos.json` numa central: painel de todos os projetos, trabalhar em qualquer um pelo nome e preparar cada um para trabalho quase autônomo |
| `/autonomo:skills-recomendadas` | Sugere e instala plugins oficiais úteis para o seu tipo de projeto |
| `/autonomo:implantar` | Publica o projeto: prévia automática, produção com aprovação, caminho de volta |

O Claude também usa as skills sozinho quando o pedido combina, por exemplo "quero criar um site".

## O que o nível recomendado faz

O Nível 2 liga o modo auto, em que um segundo modelo revisa cada ação, e acrescenta:

- regras que bloqueiam a leitura de `.env`, chaves SSH e credenciais de nuvem;
- regras que bloqueiam push forçado e a exclusão de repositórios;
- confirmação obrigatória para publicar em produção;
- sandbox de comandos, que restringe a escrita à pasta do projeto e protege segredos contra leituras indiretas.

As barreiras foram testadas no Claude Code 2.1.316, inclusive no modo que pula todas as checagens.
Os limites conhecidos estão em [`skills/niveis/SKILL.md`](skills/niveis/SKILL.md).

## Estrutura

```
autonomo/
├── .claude-plugin/plugin.json
└── skills/
    ├── comecar, diagnostico, configurar-autonomia, verificar-barreiras, ideias, novo-projeto,
    │   implantar, mapear-projetos, central, skills-recomendadas
    │                comandos que a pessoa usa (/autonomo:...)
    └── como-ensinar, links, niveis, modelos, ideias-por-segmento
                     referências que o Claude carrega pela ferramenta Skill (não aparecem no menu)
```

## Desfazer

`/autonomo:configurar-autonomia` faz backup antes de mudar qualquer arquivo e explica como restaurar.
Para remover o plugin: `claude plugin uninstall autonomo@o-arco`.

Licença MIT. Parte do curso [Engenharia de IA Aplicada](https://triadic.life/curso-ia/).

## Por que as referências são skills

As skills carregam o material de apoio pela ferramenta Skill, nunca lendo arquivos do plugin. Os
arquivos do plugin ficam fora da pasta do projeto, e no Windows (onde não há sandbox) o modo auto
pergunta, em inglês, antes de cada leitura fora da pasta. Se a pessoa escolhesse bloquear, o plugin
deixaria de funcionar. Carregar pela ferramenta Skill evita a pergunta.
