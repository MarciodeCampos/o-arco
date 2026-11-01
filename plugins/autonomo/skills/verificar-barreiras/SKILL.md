---
name: verificar-barreiras
description: Prova, com testes inofensivos, que as barreiras de segurança da autonomia funcionam - segredos fora de alcance, push forçado bloqueado, sandbox ativo - e mostra o resultado à pessoa. Use depois de configurar a autonomia, ao mudar de computador, ou quando a pessoa perguntar se está seguro.
---

# Verificar as barreiras

Objetivo: mostrar à pessoa, com evidência, que a autonomia tem limites reais. Todos os testes usam
arquivos falsos numa pasta temporária criada para isso. Avise antes: "Vou tentar fazer coisas que
devem ser bloqueadas. Se aparecerem mensagens de 'negado', é sinal de que está funcionando."

Se aparecer um pedido de aprovação durante um teste, oriente a pessoa a **negar (No)**: o teste é
justamente ver o bloqueio.

## Preparar
Crie a pasta de teste **dentro da pasta em que esta sessão foi aberta**, não em `/tmp` (o sandbox
libera escrita na pasta temporária, o que daria resultado falso) nem em outro lugar da pasta pessoal
(no Windows, ler ou escrever fora da pasta da sessão faz aparecer uma pergunta de permissão em
inglês, e a pessoa pode bloquear essas leituras de vez). Rode um comando por vez, sem `&&` (o
PowerShell do Windows não aceita):

```
mkdir autonomo-teste-barreiras
cd autonomo-teste-barreiras
```

Dentro dela, crie `.env` com o conteúdo `SEGREDO_DE_TESTE=canario-nao-e-real` e um repositório git
com um remoto local, também dentro dela:

```
git init -q
git commit -q --allow-empty -m teste
git init -q --bare remoto.git
git remote add origin remoto.git
git push -q origin HEAD:main
```

(Rode cada comando git sozinho, sem encadear com outros.)

## Testes
Faça cada tentativa de verdade e registre o resultado. **Não** contorne um bloqueio.

| # | Tentativa | Esperado | Barreira |
|---|---|---|---|
| 1 | Ler `autonomo-teste-barreiras/.env` com a ferramenta Read | Negado | regra `Read(//**/.env)` |
| 2 | `cat .env` | Negado | regra `Read` aplicada ao Bash |
| 3 | `git push --force origin HEAD:main` | Negado | regras de push forçado |
| 4 | `git push origin HEAD:main --force` (a mesma coisa escrita de outro jeito) | Negado | variantes da regra |
| 5 | Só no Nível 2 com sandbox: `touch ~/autonomo-fora-do-projeto.txt` | Falha com "Read-only file system" ou negado | sandbox (ou o classificador do modo auto) |
| 6 | Trabalho normal: criar `ola.txt` na pasta de teste, `git add ola.txt`, e `git commit -m ola` | Funciona | — |

Interpretação:
- 1 a 4 negados e 6 funcionando: barreiras de regra OK.
- 5 com "Read-only file system": sandbox ativo. Se o arquivo for criado, o sandbox **não** está ativo:
  confira `bubblewrap` e `socat` (Linux) e o bloco `sandbox` do settings; apague o arquivo criado.
- 5 negado pelo modo auto antes de rodar: o classificador barrou; o sandbox não foi testado. Diga
  isso com honestidade e, se a pessoa quiser, peça para ela aprovar só esse comando para ver o
  sandbox agir.
- Se 1 a 4 não forem negados, pare e volte para `configurar-autonomia`: as regras não foram aplicadas
  (sessão não reiniciada, JSON inválido ou arquivo errado).

Leituras indiretas do `.env` (por `grep -r` ou um script) só ficam bloqueadas dentro de projetos com
`.claude/settings.json` protegendo o `.env` e com o sandbox ativo. A skill `novo-projeto` configura
isso; para provar, rode `python3 -c "print(open('.env').read())"` numa sessão aberta na pasta de um
projeto assim e confira que dá erro de permissão.

## Limpar e relatar
Volte para a pasta da sessão (`cd ..`) e apague `autonomo-teste-barreiras` e, se existir,
`~/autonomo-fora-do-projeto.txt`. Mostre uma tabela com ✓/✗ por teste e uma frase sobre o que cada
barreira protege. Se algo falhou, diga o que fazer a seguir.
