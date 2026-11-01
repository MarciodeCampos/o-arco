---
name: niveis
description: Tabela dos níveis de autonomia (0 a 3), o que cada barreira faz e os limites conhecidos. Carregue antes de apresentar ou aplicar um nível de autonomia.
user-invocable: false
---

# Níveis de autonomia

Apresente estes níveis à pessoa com as palavras da coluna "Como explicar". Recomende o Nível 2 numa
máquina pessoal e o Nível 3 só dentro de contêiner, máquina virtual ou sessão na nuvem.

| Nível | Como explicar | O que configura | Onde |
|---|---|---|---|
| 0 · Manual | "Eu peço sua aprovação para tudo que não for só ler." | Nada: é o padrão `default` | — |
| 1 · Assistido | "Eu edito arquivos sem perguntar; comandos, eu pergunto." | modelo `usuario-nivel-1-assistido.json` da skill `autonomo:modelos` | `~/.claude/settings.json` |
| 2 · Autônomo com barreiras (recomendado) | "Eu trabalho sozinho. Um segundo modelo revisa cada ação e bloqueia o que for perigoso ou irreversível. Seus segredos ficam fora do meu alcance, e publicar em produção sempre pede seu ok." | modelos `usuario-nivel-2-autonomo.json` e, em cada projeto, `projeto-settings.json`, da skill `autonomo:modelos` | `~/.claude/settings.json` e `.claude/settings.json` do projeto |
| 3 · Autônomo total isolado | "Eu faço tudo sem perguntar, mas dentro de uma caixa separada do seu computador, que pode ser jogada fora." | `--dangerously-skip-permissions` dentro de um dev container ou sessão na nuvem | Só no contêiner |

## O que cada barreira faz (testado com o Claude Code 2.1.316)

| Barreira | Efeito verificado |
|---|---|
| `Read(//**/.env)` no usuário | Bloqueia a ferramenta Read e `cat .env` em qualquer pasta, mesmo em `bypassPermissions` |
| `Read(./.env)` no projeto + sandbox ativo | Bloqueia também leituras indiretas (`grep -r`, um script Python) |
| `Read(~/.ssh/**)` e afins + sandbox ativo | Bloqueia chaves e credenciais por qualquer caminho |
| Regras `Bash(git push *--force*)` e variantes | Bloqueiam push forçado escrito de várias formas, mesmo em `bypassPermissions` |
| Regras `ask` de produção | Publicar em produção sempre pede confirmação, inclusive no modo auto |
| Modo auto | Um classificador revisa cada ação; bloqueia escalada de escopo, destinos não confiáveis e injeção de prompt |

## Limites conhecidos (diga à pessoa)
- Regras de texto casam com o comando como foi escrito. `git -C . push --force` escapa das regras;
  a defesa robusta é a **proteção de branch no GitHub** (skill `novo-projeto`) e o classificador do
  modo auto.
- No Linux, o sandbox precisa de `bubblewrap` e `socat`. Sem eles, o Claude Code roda **sem sandbox,
  em silêncio**. A skill `diagnostico` confere; a `configurar-autonomia` instala.
- O sandbox no Linux não aceita curinga no começo do caminho: `//**/.env` não vira regra do sandbox.
  Por isso o `.env` também é protegido em cada projeto, com `Read(./.env)`.
- No Linux com sandbox, comandos git encadeados com outros (`echo x && git add -A`) rodam dentro do
  sandbox e podem tropeçar em arquivos de proteção. Rode comandos git sozinhos.
- O modo auto precisa de um modelo compatível e pode ser desligado pela organização; nesse caso a
  sessão começa no modo Manual.
