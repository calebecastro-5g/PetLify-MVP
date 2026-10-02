# Roteiro aprovado do PetLify

Aprovado por Calebe em 30/09/2026. Executar na ordem abaixo e explicar cada etapa ao estudante.
Este registro mantém a ordem combinada; decisões de contratação de serviços, custos ou mudanças de negócio ainda dependem das informações correspondentes.

| Ordem | Etapa | Estado | Critério de conclusão |
| --- | --- | --- | --- |
| 1 | Consolidar código e documentação | Concluído em 30/09/2026 | Versão de trabalho incorpora a main; guias descrevem o código atual; registros locais preservados |
| 2 | Testar uma jornada completa pelo navegador | Concluído em 30/09/2026 | Cadastro, pet, compra simulada, agendamento, cota, cancelamento e remarcação verificados; celular e isolamento entre lojas avaliados |
| 3 | Corrigir o tratamento de datas e horários | Concluído em 02/10/2026 | Contrato de horários definido; conversão entre armazenamento e exibição testada; legado tratado explicitamente |
| 4 | Configurar banco persistente antes de usar dados importantes | Concluído em 02/10/2026 | Banco escolhido; migrações testadas; backup e restauração demonstrados; implantação validada |
| 5 | Automatizar a verificação no GitHub | Pendente | Testes de backend e build frontend executam nos pull requests e indicam falhas |
| 6 | Completar a operação da equipe | Pendente | Histórico de usos para funcionário/dono; política de retenção de registros definida e implementada |

## Passo 1 — Consolidar

- Atualizar referências remotas e partir da main integrada, preservando registros posteriores.
- Atualizar README, guia do banco, cotas e continuidade.
- Usar CONTINUIDADE.md como estado atual; os guias por etapa e o Git registram a evolução.
- Confirmar os 12 modelos de domínio e a revisão c83f9e205d16.
- Sincronizar a cópia executável somente depois de comparar arquivos para preservar alterações de outras ferramentas.

## Passo 2 — Jornada completa

Usar uma base temporária, separada de backend/instance/petlify.db.
Preparar lojas de demonstração; cadastrar um tutor novo, cadastrar seu pet, contratar um plano com pagamento simulado e agendar um serviço.
Verificar limite esgotado, cancelamento liberando uso e remarcação preservando saldo.
Repetir verificações de apresentação em largura de celular e de isolamento com outra loja.
Registrar resultados reais, falhas, correções e limitações em validacao-jornada.md.
O caminho aprovado deve ser demonstrado pela interface; testes de API complementam as verificações.

Resultado de 30/09/2026: jornada aprovada, com três correções e limites registrados em [validacao-jornada.md](validacao-jornada.md). Suíte: 24 testes aprovados; build TypeScript/Vite aprovado. Próximo passo: 3.

## Passo 3 — Datas e horários

Contrato implementado: instantes de compra/assinatura/auditoria em UTC; agenda/vacina em America/Sao_Paulo. A API informa o fuso e as telas usam o fuso da loja.
Valores legados preservados, sem migração de dados; origens ambíguas documentadas.
Resultado de 02/10/2026: 32 testes de backend, 14 de frontend, build e QA de compra, reserva/edição e vacina aprovados. Detalhes e texto para ata: [datas-e-horarios.md](datas-e-horarios.md). Próximo passo: 4.

## Passo 4 — Persistência

O Render demo anterior usava SQLite em /tmp, sem garantia de preservação. A nova configuração exige banco externo em produção.
Restrição definida por Calebe em 02/10/2026: “Precisamos de uma opção gratuita”.
Preparado PostgreSQL no Neon Free, com possibilidade de aumentar o plano depois. As seis migrações, cotas, isolamento, concorrência, reinício e backup/restauração passaram em PostgreSQL 18.4 temporário (13 verificações); 39 testes de backend aprovados.
Projeto PetLify Free criado no Neon em Ohio, banco petlify, branch production, PostgreSQL 18.6. Seis migrações aplicadas; modelos e database-check aprovados; TLS 1.3 confirmado. Backup inicial do Neon restaurado em PostgreSQL local separado, comparando as 13 tabelas.
Calebe confirmou que os cadastros publicados são demonstração e autorizou começar vazio. Após explicação/autorização específica, Render conectado ao Neon com SEED_DEMO=false e branch codex/banco-persistente publicada, sem merge. Jornada de QA publicada aprovada; reinício preservou cadastros/saldo; IDs conferidos diretamente no Neon. Novo backup com os registros restaurado em PostgreSQL local separado, comparando as 13 tabelas e sequências.
Resultado de 02/10/2026: passo 4 concluído. Guia didático, resultados, limitação da primeira tentativa e texto para ata: [banco-persistente.md](banco-persistente.md). Próximo: passo 5. Metadados/revisão/integração dos PRs e backups automáticos ainda pendentes; não foi testada restauração em outro serviço de nuvem.

## Passo 5 — Verificações automáticas

Usar as versões e arquivos de dependências do repositório.
Executar testes com bancos temporários e compilar o frontend em pull requests.
Guardar resultados visíveis ao grupo; não usar dados ou credenciais de produção nos testes.

## Passo 6 — Operação

Oferecer consulta de assinatura, uso reservado/consumido e cancelamentos aos perfis autorizados.
Definir como preservar histórico de atendimentos e pagamentos ao excluir ou desativar registros.
Revisar a experiência com o grupo e preparar roteiro de apresentação acadêmica.
PIX/cartão reais e renovação automática são evoluções futuras conforme o escopo do grupo.

## Ao concluir um passo

Atualizar estado e evidências neste roteiro, CONTINUIDADE.md e no registro da etapa.
Explicar problema, alteração e verificação. Criar commits revisáveis e manter autoria/histórico do grupo.
