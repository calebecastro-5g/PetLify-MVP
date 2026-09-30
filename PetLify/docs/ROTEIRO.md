# Roteiro aprovado do PetLify

Aprovado por Calebe em 30/09/2026. Executar na ordem abaixo e explicar cada etapa ao estudante.
Este registro mantém a ordem combinada; decisões de contratação de serviços, custos ou mudanças de negócio ainda dependem das informações correspondentes.

| Ordem | Etapa | Estado | Critério de conclusão |
| --- | --- | --- | --- |
| 1 | Consolidar código e documentação | Concluído em 30/09/2026 | Versão de trabalho incorpora a main; guias descrevem o código atual; registros locais preservados |
| 2 | Testar uma jornada completa pelo navegador | Concluído em 30/09/2026 | Cadastro, pet, compra simulada, agendamento, cota, cancelamento e remarcação verificados; celular e isolamento entre lojas avaliados |
| 3 | Corrigir o tratamento de datas e horários | Pendente | Contrato de horários definido; conversão entre armazenamento e exibição testada; legado tratado explicitamente |
| 4 | Configurar banco persistente antes de usar dados importantes | Pendente | Banco escolhido; migrações testadas; backup e restauração demonstrados; implantação validada |
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

Hoje datas sem fuso e remoção de offset coexistem no MVP.
Escolher um contrato consistente antes de converter dados antigos: separar horários de agenda da loja e instantes de compra/assinatura.
Testar vigência, fronteiras dos blocos e cancelamento de seis horas.
Não reinterpretar todos os registros antigos como UTC sem examinar sua origem.

## Passo 4 — Persistência

O Render demo usa SQLite em /tmp, sem garantia de preservação.
Escolher com o grupo um serviço/banco compatível com orçamento e requisitos.
Preparar e testar migrações em ambiente separado, backup e restauração antes da adoção.
Conectar serviço e implantar somente quando destino, credenciais e eventuais custos estiverem definidos.

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
