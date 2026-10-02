# Continuidade do PetLify

Atualizado em 02/10/2026. Estado atual da retomada; registros anteriores continuam nos guias de cada etapa e no histórico Git.

## Como estamos trabalhando

Calebe cursa Engenharia de Software e participa do grupo. Pediu: “sempre que for realizar algo me ajude explicando, para eu saber oq esta acontecendo”.
Explicar o problema, a alteração e a verificação passo a passo. Registrar decisões para ata e comunicação com os colegas.

Calebe pretende alternar entre Codex e Claude, provavelmente na mesma pasta. Ainda não existe divisão definitiva ou tarefa atribuída ao Claude.
Antes de editar, conferir mudanças existentes e evitar edição simultânea dos mesmos arquivos.

## Ordem aprovada em 30/09/2026

O roteiro oficial está em [ROTEIRO.md](ROTEIRO.md), nesta ordem:
1. Consolidar código e documentação.
2. Testar uma jornada completa pelo navegador.
3. Corrigir o tratamento de datas e horários.
4. Configurar banco persistente antes de usar dados importantes.
5. Automatizar a verificação no GitHub.
6. Completar a operação da equipe.

Retomada atual: passos 1 e 2 concluídos em 30/09/2026; passo 3 concluído em 02/10/2026. Passo 4 em andamento: preparação PostgreSQL gratuita validada localmente; conectar Neon/Render e validar implantação/recuperação na nuvem. Manter essa ordem; não tratar verificações ainda não feitas como concluídas.

## Versões e pastas

- Repositório: https://github.com/calebecastro-5g/PetLify-MVP
- Aplicação no repositório Git: github-publicacao/PetLify.
- Cópia executável local: PetLify-Copia; contém .venv e backend/instance/petlify.db.
- O Git usado para publicação está em github-publicacao. A pasta superior e a cópia do ZIP não substituem esse histórico.
- PR #1 integrado à main: https://github.com/calebecastro-5g/PetLify-MVP/pull/1
- Commit da tela de saldo: 5f8ce01; integração na main: 84911c6.
- Branch dos passos 1–2: codex/consolidacao-validacao. Incorpora origin/main e os registros posteriores sem reescrever histórico.
- Branch do passo 3: codex/datas-horarios, derivada da anterior; commit f173150.
- Branch do passo 4: codex/banco-persistente, derivada de codex/datas-horarios. Preparação PostgreSQL gratuita e recuperação de dados validadas localmente; implantação pendente.
- Passo 3 publicado no PR #3, aberto para revisão: https://github.com/calebecastro-5g/PetLify-MVP/pull/3. Base: codex/consolidacao-validacao; depende do PR #2. Integrar #2 primeiro e depois conferir/ajustar a base de #3 para main antes de integrar. Nenhum dos dois foi integrado ao encerrar esta etapa.
- Passos 1 e 2 publicados no PR #2, aberto para revisão: https://github.com/calebecastro-5g/PetLify-MVP/pull/2. Ainda não integrado à main no encerramento desta etapa.
- Commits das correções e do roteiro/validação: 829fef6 e 0a9930d.

## Implementado

| Etapa | Revisão/alteração | Resultado |
| --- | --- | --- |
| 1 | 9184049026b0 | Sete tabelas iniciais e adoção de migrações |
| 2 | 1d532c0cfeb8 | Catálogo, benefícios e assinaturas por pet; compra transacional |
| 3 | 73032ec89a26 | Chaves compostas de mesma loja; foreign_keys em SQLite |
| 4 | a4b62c819f03 | Agendamento exige tutor e assinatura do pet correto |
| 5 | b72e8d194c05 | Pagamento vinculado ao cliente/agendamento ou tutor/pet da assinatura |
| 6 | c83f9e205d16 | Cotas separadas por serviço; limites contratados; concorrência na última cota |
| 7 | 5f8ce01 | Saldo na área do cliente, por pet e por data de atendimento |
| Retomada, passos 1–2 | codex/consolidacao-validacao | Guias consolidados; jornada validada; rotas diretas React, altura dos cartões e ciclo no checkout corrigidos |
| Retomada, passo 3 | codex/datas-horarios | UTC explícito para instantes; horário de São Paulo para agenda/vacina; comparações e telas corrigidas sem regravar legado |
| Retomada, passo 4 | codex/banco-persistente | Psycopg, produção exige banco externo, verificação de implantação e backup/restauração PostgreSQL; nuvem pendente |

São 12 tabelas de domínio, além de alembic_version. O arquivo SQLite local fica em backend/instance/petlify.db e não entra no Git.
GET /api/subscriptions consulta o histórico autorizado; GET /api/subscriptions/<id>/usage consulta uso por bloco.
Render aplica migrações no início; seed somente com SEED_DEMO=true.

## Regras e limites atuais

- Assinatura dura 30 dias; compra nova substitui a anterior, sem renovação automática.
- Básico: 1 banho e 1 tosa por bloco de 15 dias. Premium: 1 de cada por bloco de 7 dias. Plus: 2 de cada por bloco de 7 dias.
- Plus inclui hidratação, corte de unha e limpeza de ouvido, 1 de cada por ciclo.
- Blocos começam na contratação; bloco semanal final de dois dias recebe a cota normal.
- Pendentes/confirmados reservam uso; concluídos/faltas consomem; cancelados não contam.
- Cancelamento aceito libera uso; permanece a regra de seis horas para o cliente.
- As regras contratadas são copiadas em subscription_limits.
- PIX/cartão são simulados. Seed redefine contas demo; não executar sobre dados a preservar.
- pets.plan permanece legado. Transição de planos legados concedeu 30 dias sem inventar pagamentos.
- Datas/fuso seguem [o contrato do passo 3](datas-e-horarios.md): UTC para instantes, America/Sao_Paulo para agenda/vacina, exibição no fuso da loja. Legado ambíguo está documentado.
- Conexão persistente externa, compras repetidas/concorrentes e retenção de histórico precisam evoluir.
- Banco persistente precisa ser gratuito, conforme resposta de Calebe em 02/10/2026.
- Cotas transacionais foram testadas em SQLite e PostgreSQL 18.4 temporário; isso não certifica lotação simultânea da loja entre assinaturas distintas nem a implantação na nuvem.
- Catálogo ainda tem definições fixas no frontend/backend.

## Evidências anteriores

- Etapa 6: 22 testes de backend aprovados em SQLite temporário, incluindo disputa pela última cota e modelos/migrações.
- Migração local c83f9e205d16: conteúdo das 11 tabelas anteriores preservado; 11 limites de assinatura inseridos; foreign_key_check sem violações.
- Backup: backend/instance/petlify-before-c83f9e205d16-20260929-232533.db.
- Etapa 7: TypeScript/Vite compilados; preview temporário mostrou saldos de Mel e Thor. Naquele momento, a jornada completa ainda aguardava a verificação do passo 2.
- O documento Word registro-de-alteracoes-petlify.docx registra etapas anteriores; revisão visual pendente por ausência do renderizador. Guias Markdown registram os adendos.
- Na etapa inicial, Render e outros bancos ainda não tinham sido validados. PostgreSQL local foi validado na preparação do passo 4; Render/Neon permanecem pendentes.

## Evidências da retomada — 30/09/2026

- Jornada principal pela interface: novo tutor/pet, compra simulada, reserva, bloqueio de cota, cancelamento liberando uso e edição sem duplicação.
- Apresentação em 1280 × 900 e 390 × 844; conta de outra loja mostrou somente seus dados.
- Corrigido 404 ao abrir/recarregar rotas React no Flask; arquivos ausentes e endpoints de API continuam retornando 404.
- Corrigidos cartão sem plano esticado e preço do checkout para ciclo de 30 dias.
- 24 testes de backend aprovados (22 anteriores e 2 de regressão); build TypeScript/Vite aprovado.
- Preview reproduzível: backend/preview_journey.py, banco descartável separado do desenvolvimento.
- Relatório detalhado e texto para ata: [validacao-jornada.md](validacao-jornada.md).
- Diferença de três horas observada na contratação em 30/09; corrigida no passo 3, conforme o novo contrato de horários.

Comando na cópia executável, a partir de backend:
```powershell
..\.venv\Scripts\python.exe -W ignore::DeprecationWarning -m unittest discover -s tests -v
```

## Evidências do passo 3 — 02/10/2026

- 32 testes de backend aprovados: 24 anteriores e 8 novos, todos em SQLite temporário.
- 14 testes de frontend aprovados em dispositivos configurados em UTC e Asia/Tokyo; build TypeScript/Vite aprovado.
- Navegador: compra às 01:16 locais; reserva em 03/10 às 08h preservada ao editar/salvar; um uso de banho reservado.
- Edição de vacina preservou aplicação e validade ao salvar apenas o lote.
- Revisão c83f9e205d16 permanece; nenhuma migração de dados neste passo. Banco de desenvolvimento não usado para QA.
- Documento para ensino/ata: [datas-e-horarios.md](datas-e-horarios.md).
- Próximo: preparar banco persistente gratuito; implantação e backup/restauração ainda pendentes.

## Evidências e pendências do passo 4 — 02/10/2026

- 39 testes de backend aprovados: 32 anteriores e 7 novos de configuração e comandos de verificação.
- 13 verificações em PostgreSQL 18.4 temporário: seis migrações compatíveis com modelos, compra/reserva, cotas, isolamento, concorrência no último uso, permanência após reinício, backup/restauração integral e sequências de IDs.
- Produção exige DATABASE_URL externa; Render não retorna silenciosamente a SQLite em /tmp. SQLite local preservado.
- Nenhum arquivo de migração/modelo alterado; revisão c83f9e205d16 mantida.
- Driver Psycopg 3.3.6 instalado na .venv local. Ferramentas de backup exigem executáveis PostgreSQL, já encontrados em C:/Program Files/PostgreSQL/18/bin neste computador.
- Documento para ensino e ata: [banco-persistente.md](banco-persistente.md). Explica plano pago futuro e migração entre provedores.
- Antes de sincronizar a cópia executável, 76 arquivos versionados foram comparados com a base Git; nenhuma alteração independente foi encontrada.
- Pendentes: conta/projeto Neon Free, configuração secreta da URL no Render, definição dos dados SQLite a transferir, implantação e restauração no ambiente escolhido. Não declarar o passo 4 concluído antes disso.
- Não foi criado backup externo automático nem contratação; PIX/cartão permanecem simulados.

## Registro da retomada

30/09/2026: roteiro de seis passos aprovado e salvo. Referências remotas atualizadas; nova branch incorpora main e registros posteriores.
Documentação consolidada e cópia executável sincronizada após comparação dos arquivos. Passos 1 e 2 concluídos; próximos passos preservados no roteiro. Nenhum banco persistente externo foi contratado ou implantado.

02/10/2026: passo 3 concluído e registrado. Comparação dos 71 arquivos versionados não encontrou alterações independentes na cópia executável antes da sincronização. Calebe definiu que o banco da próxima etapa deve ser gratuito.

02/10/2026: passo 4 preparado para PostgreSQL no Neon Free. Calebe autorizou prosseguir e perguntou sobre banco pago futuro; caminho de upgrade e transferência documentado. Validação PostgreSQL feita em ambiente temporário separado dos dados locais.
