---
name: implantar
description: Publica o projeto na internet com segurança - escolhe a plataforma, configura login e segredos sem expô-los, publica uma prévia automaticamente, verifica que funciona e só leva para produção com a aprovação da pessoa, com caminho de volta. Use quando a pessoa quiser colocar o site ou aplicativo no ar, publicar, fazer deploy ou atualizar o que já está publicado.
---

# Implantar com portões

Carregue, com a ferramenta Skill, `autonomo:como-ensinar` (se ainda não carregou nesta sessão) e
`autonomo:links`. Nunca leia arquivos do plugin com Read.

Regra central: **prévia é automática; produção pede a aprovação da pessoa**, depois que ela viu a
prévia funcionando. As regras `ask` do Nível 2 já fazem o Claude Code pedir confirmação para os
comandos de produção mais comuns; ainda assim, sempre pergunte antes com suas palavras.

## 1. Antes de publicar
- Os testes passam e o build funciona localmente. Se não, conserte antes.
- `git status` limpo e tudo no GitHub (`git push`).
- Nenhum segredo no código: procure por chaves no repositório (`git grep -nE "sk-|api[_-]?key|secret|token"`)
  e confira que `.env` está no `.gitignore`.

## 2. Escolher a plataforma
Recomende pelo tipo de projeto e confirme (AskUserQuestion):
| Projeto | Plataforma recomendada | Custo inicial |
|---|---|---|
| Site estático | GitHub Pages | Gratuito em repositório público; repositório privado exige plano pago do GitHub |
| Aplicativo Next.js ou front-end com build | Vercel | Plano gratuito para uso pessoal |
| API ou serviço em Python ou Node | Render | Plano gratuito com limitações |
Diga claramente se a plataforma escolhida pode gerar cobrança e onde a pessoa acompanha isso.

## 3. Conta e login (a pessoa faz, você orienta)
- Mande o link de cadastro da plataforma (skill `autonomo:links`) e espere ela confirmar.
- Logins que abrem o navegador (`vercel login`, `gh auth login`): siga a seção "Logins pelo
  navegador" da skill `autonomo:como-ensinar` (no Windows, numa janela separada do PowerShell).

## 4. Segredos
Se o projeto usa chaves (API, banco de dados), elas vão no painel da plataforma, nunca no código nem
na conversa:
- Vercel: Project → Settings → Environment Variables.
- Render: o serviço → Environment.
- GitHub Actions: `https://github.com/<dono>/<repo>/settings/secrets/actions`.
Mande o link direto, diga o nome exato da variável (o mesmo do `.env.example`) e espere ela
confirmar que colou o valor lá.

## 5. Publicar a prévia
- GitHub Pages: crie `.github/workflows/pages.yml` com `actions/upload-pages-artifact` e
  `actions/deploy-pages`, ative o Pages com `gh api -X POST repos/<dono>/<repo>/pages -f build_type=workflow`
  e publique pela branch `main`. No Pages não há prévia separada: trate a abertura do pull request
  como prévia (a pessoa revisa o diff e a página local) e o merge como produção.
- Vercel: `vercel` (sem `--prod`) cria uma prévia com endereço próprio.
- Render: crie o serviço pelo painel ligado ao repositório; cada push na branch configurada publica.

## 6. Verificar
- Acesse o endereço (`curl -sI <url>` deve dar 200) e, se tiver Playwright, abra a página e tire uma
  captura. Mostre o link para a pessoa abrir no celular também.
- Se falhar, leia os logs da plataforma, corrija, publique de novo.

## 7. Produção (com aprovação)
Pergunte: "A prévia está em <url>. Posso publicar em produção?" Só depois do sim:
- Vercel: `vercel --prod` (o Claude Code também vai pedir confirmação: é uma regra `ask`).
- GitHub Pages: merge do pull request na `main` (`gh pr merge`).
Verifique de novo o endereço final e registre-o no README.

## 8. Caminho de volta
Explique e anote no README como desfazer:
- Vercel: `vercel rollback` ou promover a implantação anterior pelo painel.
- GitHub Pages e Render: `git revert` do commit problemático e push.
Termine com o resumo: endereço publicado, onde ficam os segredos, como atualizar (pedir ao Claude
"publique a nova versão") e como desfazer.
