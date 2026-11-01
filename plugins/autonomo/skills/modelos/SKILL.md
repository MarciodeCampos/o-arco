---
name: modelos
description: Modelos de configuração do plugin autonomo - settings por nível de autonomia, settings de projeto e o bloco do CLAUDE.md da pessoa. Carregue quando for aplicar um nível de autonomia ou criar o .claude/settings.json de um projeto.
user-invocable: false
---

# Modelos de configuração

Copie o conteúdo do modelo certo; não leia arquivos do plugin com a ferramenta Read.

## usuario-nivel-1-assistido.json

Nível 1 · Assistido (`~/.claude/settings.json`)

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "deny": [
      "Read(//**/.env)",
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Read(~/.gnupg/**)",
      "Read(~/.config/gcloud/**)",
      "Read(~/.azure/**)",
      "Read(~/.kube/**)",
      "Read(~/.docker/config.json)",
      "Read(~/.npmrc)",
      "Read(~/.netrc)",
      "Read(~/.config/gh/hosts.yml)",
      "Bash(git push *--force*)",
      "Bash(git push * -f)",
      "Bash(git push * -f *)",
      "Bash(git push -f *)",
      "Bash(git push *+*)",
      "Bash(git -C * push *--force*)",
      "Bash(gh repo delete *)",
      "Bash(terraform destroy *)"
    ]
  }
}
```

## usuario-nivel-2-autonomo.json

Nível 2 · Autônomo com barreiras (`~/.claude/settings.json`)

```json
{
  "permissions": {
    "defaultMode": "auto",
    "deny": [
      "Read(//**/.env)",
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Read(~/.gnupg/**)",
      "Read(~/.config/gcloud/**)",
      "Read(~/.azure/**)",
      "Read(~/.kube/**)",
      "Read(~/.docker/config.json)",
      "Read(~/.npmrc)",
      "Read(~/.netrc)",
      "Read(~/.config/gh/hosts.yml)",
      "Bash(git push *--force*)",
      "Bash(git push * -f)",
      "Bash(git push * -f *)",
      "Bash(git push -f *)",
      "Bash(git push *+*)",
      "Bash(git -C * push *--force*)",
      "Bash(gh repo delete *)",
      "Bash(terraform destroy *)"
    ],
    "ask": [
      "Bash(npm publish *)",
      "Bash(vercel --prod *)",
      "Bash(vercel deploy --prod *)",
      "Bash(netlify deploy --prod *)",
      "Bash(fly deploy *)",
      "Bash(terraform apply *)",
      "Bash(kubectl delete *)",
      "Bash(gh release create *)",
      "Bash(gh repo edit *)"
    ]
  },
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "excludedCommands": [
      "git *",
      "docker *"
    ],
    "network": {
      "allowedDomains": [
        "registry.npmjs.org",
        "pypi.org",
        "files.pythonhosted.org",
        "github.com",
        "*.github.com",
        "*.githubusercontent.com"
      ]
    }
  }
}
```

## projeto-settings.json

Projeto (`.claude/settings.json` de cada projeto)

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.local)",
      "Read(./.env.*.local)",
      "Read(./.env.production)",
      "Read(./secrets/**)"
    ]
  }
}
```

## claude-md-usuario.md

Bloco do CLAUDE.md da pessoa (`~/.claude/CLAUDE.md`)

```markdown
<!-- autonomo:inicio — bloco mantido pelo plugin autonomo; edite à vontade, a skill configurar-autonomia preserva o que estiver fora dos marcadores -->
## Como trabalhar comigo

- Sou {{PERFIL}}. Explique termos técnicos na primeira vez, em uma frase, e diga o que vai fazer antes de fazer.
- Fale comigo em {{IDIOMA}}.
- Trabalhe com autonomia: planeje, implemente, rode os testes e corrija até passar, sem me pedir confirmação a cada passo. Me chame para decisões de produto, gastos, contas e publicação em produção.
- Antes de considerar uma tarefa pronta, verifique: testes, build ou a página funcionando. Me mostre a evidência.
- Trabalhe em branches e faça commits pequenos com mensagens claras. Nunca reescreva o histórico de `main`.
- Nunca me peça senhas, chaves ou tokens na conversa. Me ensine a colocá-los no `.env` do projeto ou no painel de segredos da plataforma, com o link direto.
- Quando uma permissão for negada, me explique em linguagem simples o que tentou, por que foi bloqueado e qual alternativa segura existe. Não tente contornar o bloqueio.
- Em todo projeto novo: `.gitignore` com `.env`, `.claude/settings.json` protegendo `.env`, testes desde o primeiro dia e um `CLAUDE.md` com os comandos de teste e de build.
- No Linux com sandbox, rode comandos git sozinhos, sem encadear com outros comandos.
- Nível de autonomia configurado: {{NIVEL}} (em {{DATA}}). Para revisar, use `/autonomo:configurar-autonomia`.
<!-- autonomo:fim -->
```
