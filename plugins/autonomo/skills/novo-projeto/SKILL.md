---
name: novo-projeto
description: Cria um projeto do zero com a pessoa - a partir de uma ideia em palavras simples - já com git, testes, proteção de segredos, CLAUDE.md, repositório no GitHub e integração contínua, e desenvolve a primeira versão até funcionar. Use quando a pessoa quiser começar um site, aplicativo, automação ou qualquer projeto novo.
argument-hint: "[ideia do projeto]"
---

# Novo projeto

Carregue a skill `autonomo:como-ensinar` (ferramenta Skill) se ainda não carregou nesta sessão.
Nunca leia arquivos do plugin com Read.
Ideia recebida (pode estar vazia): $ARGUMENTS

## 1. Entender a ideia
Se a ideia não veio, pergunte em linguagem simples: o que ela quer que exista, para quem, e como vai
saber que funcionou. Transforme a resposta em:
- **Primeira versão** (o mínimo que já é útil), em até 5 itens;
- **Critério de pronto** verificável ("a página abre no celular e o formulário envia");
- **Fora do escopo por enquanto**.
Mostre e peça confirmação.

## 2. Escolher a tecnologia (recomende, não pergunte o que ela não sabe)
| Objetivo | Recomendação padrão | Teste | Publicação |
|---|---|---|---|
| Site ou página | HTML, CSS e JavaScript sem framework; Vite se precisar de build | Playwright (página abre, links funcionam) | GitHub Pages |
| Aplicativo web | Next.js com TypeScript | Vitest + Playwright | Vercel |
| Automação ou script | Python 3 | pytest | Rodar local ou GitHub Actions agendado |
| API ou serviço | Node.js com TypeScript ou Python com FastAPI | Vitest ou pytest | Render |
Se a pessoa já conhece outra tecnologia, use a dela. Explique a escolha em uma frase.

## 3. Criar a estrutura
Pergunte o nome do projeto e crie em `~/projetos/<nome-em-minusculas-com-hifens>` (no Windows,
`%USERPROFILE%\projetos\...`). Depois, nesta ordem:
1. `git init` (sozinho) e `git switch -c main` se necessário.
2. `.gitignore` com, no mínimo: `.env`, `.env.*`, `!.env.example`, `node_modules/`, `__pycache__/`,
   `.venv/`, `dist/`, `.DS_Store`.
3. `.claude/settings.json` a partir do modelo `projeto-settings.json` da skill `autonomo:modelos`,
   acrescentando em `permissions.allow` os comandos de teste e build do projeto
   (por exemplo `Bash(npm test *)`, `Bash(npm run build *)`, `Bash(pytest *)`). Avise que vai aparecer
   uma aprovação para a pasta `.claude` do projeto.
4. `CLAUDE.md` do projeto, curto: o que é, como rodar, **como testar**, como fazer o build,
   convenções e o critério de pronto da primeira versão.
5. `README.md` para humanos: o que é, como rodar, onde está publicado.
6. `.env.example` se o projeto usar chaves, com os nomes das variáveis e valores vazios.
7. O esqueleto do projeto e **um teste que já passa**. Rode o teste e mostre.
8. Primeiro commit: `git add -A` sozinho, depois `git commit -m "Estrutura inicial"`.

## 4. Desenvolver a primeira versão
Trabalhe com autonomia até o critério de pronto:
- Escreva o teste do comportamento, implemente, rode, corrija. Repita.
- Faça commits pequenos a cada passo que funciona.
- Para coisas visuais, mostre de verdade: abra o arquivo no navegador ou rode o servidor e diga o
  endereço (`http://localhost:...`). Se tiver Playwright, tire uma captura e mostre.
- Ao terminar, mostre a evidência: testes passando e a página ou o resultado funcionando.

## 5. GitHub
Explique o que é um repositório remoto em uma frase e pergunte se ele deve ser **privado** (padrão)
ou público. Então:
- `gh repo create <nome> --private --source . --push` (ou `--public`).
- Integração contínua: crie `.github/workflows/ci.yml` que instala as dependências e roda os
  testes em todo push e pull request. Faça commit e push, e acompanhe a primeira execução com
  `gh run watch`. Mostre o link da execução.
- Proteção da branch `main` (impede apagar e forçar push no servidor, a defesa mais robusta):
  disponível em repositórios públicos em qualquer plano, e em privados só nos planos pagos do
  GitHub. Se disponível, aplique:
  `gh api -X PUT repos/<dono>/<nome>/branches/main/protection --input -` com o JSON
  `{"required_status_checks": null, "enforce_admins": true, "required_pull_request_reviews": null, "restrictions": null, "allow_force_pushes": false, "allow_deletions": false}`.
  Se o GitHub recusar por causa do plano, explique o limite e siga: as regras do Claude continuam
  bloqueando push forçado.

## 6. Daqui para a frente
A partir de agora, trabalhe em branches para mudanças grandes (`git switch -c nome-da-mudanca`) e
abra pull requests (`gh pr create`) quando a pessoa quiser revisar antes. Para publicar, use a skill
`implantar`. Termine com o resumo: onde está o projeto, o link do GitHub, como abrir de novo
(`cd ~/projetos/<nome>` e depois `claude`, em duas linhas: o PowerShell do Windows não aceita `&&`), e três ideias de próximos pedidos.
