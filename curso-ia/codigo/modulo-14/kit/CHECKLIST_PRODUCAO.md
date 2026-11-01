# Checklist de produção para sistemas com IA

Use antes de cada entrega do Projeto Integrador e antes de qualquer lançamento real.

## Qualidade
- [ ] Dataset de avaliação com gabarito, tags e cobertura nos dois sentidos (Módulo 3)
- [ ] Resultado com intervalo de confiança, não só a taxa (Módulo 3.6)
- [ ] Teste fora da distribuição do desenvolvimento (Módulo 11.6)
- [ ] Evals rodando no CI com limiar (Módulo 3.5)

## Segurança e privacidade
- [ ] Chaves só no servidor; nada no navegador nem no repositório
- [ ] Conteúdo externo delimitado; saída limpa de links e imagens externas (Módulo 12)
- [ ] Ferramentas classificadas por risco; irreversíveis com aprovação humana (Módulo 6)
- [ ] Sem tríade letal (dados privados + conteúdo não confiável + saída livre)
- [ ] Red team rodado; ataques bem-sucedidos viraram testes
- [ ] Dados pessoais mascarados em logs; retenção definida; ficha do sistema escrita

## Operação
- [ ] Limites de taxa e orçamento por cliente (Módulo 9)
- [ ] Reserva para falhas do provedor; timeouts; cancelamento quando o usuário sai
- [ ] Log estruturado por requisição com custo, modelo, versão do prompt e latência
- [ ] Prompts versionados; caminho de rollback testado
- [ ] Alertas para erro, latência e gasto fora do normal

## Experiência do usuário
- [ ] Streaming onde há espera; botão parar (Módulo 8)
- [ ] Estados de erro claros; caminho para falar com uma pessoa
- [ ] O usuário sabe que fala com uma IA e o que ela não faz
- [ ] Acessível por teclado e leitor de tela

## Entrega
- [ ] README com problema, arquitetura, como rodar, resultados e custos
- [ ] `python verificar_projeto.py .` sem itens obrigatórios faltando
- [ ] Demonstração ao vivo ensaiada, com plano B se a rede cair
