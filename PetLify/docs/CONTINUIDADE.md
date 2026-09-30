# Continuidade do PetLify

Atualizado em 24/09/2026.

## Como estamos trabalhando

Calebe cursa Engenharia de Software e participa do grupo do projeto. Pediu: “sempre que for realizar algo me ajude explicando, para eu saber oq esta acontecendo”. Explique o problema, a mudança e a verificação passo a passo.

O usuário pretende alternar entre Codex e Claude, provavelmente na mesma pasta, quando terminar o tempo disponível em uma ferramenta. Ainda não há tarefa atribuída ao Claude nem divisão definitiva entre frontend e backend. Evite edições simultâneas nos mesmos arquivos. Este arquivo registra o contexto; não amplia a autorização do pedido atual do usuário.

## Local e origem

- Pasta de trabalho do aplicativo: `C:/Users/Calebe/OneDrive/Documentos/ChatGPT/Petlify/PetLify-Copia`.
- Origem da cópia: arquivo ZIP fornecido pelo usuário.
- Repositório informado: https://github.com/calebecastro-5g/PetLify-MVP
- Publicado no GitHub em 29/09/2026: branch `codex/banco-assinaturas-integridade`, commit de implementação `9ea1d13`. A main ainda não recebeu essas alterações.
- Na última consulta, o Git da pasta superior mostrava `PetLify-Copia/` como não rastreado. Confira o estado atual antes de preparar commits; não suponha que esta cópia contém o histórico do repositório remoto.

## Implementado

1. Migração inicial `9184049026b0` com as sete tabelas originais.
2. Caminho SQLite local `sqlite:///petlify.db`, resolvido pelo Flask dentro de `backend/instance`.
3. Render executa migrações no início; seed apenas com `SEED_DEMO=true`. Não imprime a URL do banco no log.
4. Migração `1d532c0cfeb8` adiciona `plans`, `services`, `plan_benefits`, `subscriptions` e vínculos em pagamentos e agendamentos.
5. Compra de plano cria assinatura e pagamento na mesma transação. Agendamento valida cobertura e validade. Rota `GET /api/subscriptions` consulta histórico autorizado.
6. Testes de migração, compra, substituição, senha inválida, cobertura, expiração e isolamento entre lojas.
7. Guias em `docs/banco-de-dados.md`, `docs/assinaturas.md` e `docs/roteiro-esquema-e-colaboracao.md`.
8. Registro em Word `docs/registro-de-alteracoes-petlify.docx`. A estrutura foi lida, mas a revisão visual ficou pendente porque o renderizador não encontrou LibreOffice.

## Regras provisórias e limites

- Ciclos de 30 dias, sem renovação automática; uma nova compra substitui a assinatura anterior.
- PIX e cartão permanecem simulados.
- Cotas por serviço implementadas na etapa 6: blocos desde a contratação, cancelamento libera uso e falta consome. Veja `docs/cotas-dos-planos.md`.
- Migração concede 30 dias de transição aos planos legados reconhecidos, com `source=legacy`, sem criar pagamentos fictícios. Revisar a política antes de usar dados reais.
- O texto `pets.plan` permanece como legado; a API calcula o plano pela assinatura vigente.
- Catálogo da interface e metadados do backend ainda contêm listas fixas.
- Exclusões físicas, fuso horário, concorrência e banco externo persistente ainda precisam evoluir.

## Verificação mais recente

Em 29/09/2026, os 22 testes passaram em SQLite temporário sobre a cópia Git, incluindo concorrência pela última cota. A migração local foi aplicada após backup: os dados das 11 tabelas anteriores foram comparados e preservados; foram criadas 11 configurações em subscription_limits. foreign_key_check não encontrou violações. O frontend recebeu apenas revisão textual do catálogo; build não executado (dependências locais ausentes). Render e outros bancos não foram testados.

Na pasta `backend`, com o ambiente existente na raiz do aplicativo:

```powershell
..\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Não execute o seed sobre dados que deseja preservar: ele redefine contas de demonstração e pode adicionar agendamentos.

## Próximo passo proposto

Etapa 7 concluída em 29/09/2026: o frontend do cliente agora mostra o saldo de cada serviço por pet e consulta o período correspondente à data escolhida no agendamento. O componente `frontend/src/components/SubscriptionUsage.tsx` usa `GET /api/subscriptions/<id>/usage`; o formulário informa que o saldo será conferido novamente ao salvar. Foram tratados carregamentos antigos ao trocar pet/data, falhas de consulta e tentativa de salvar quando a API rejeita a cota. O build do frontend passou com `npm.cmd run build` (TypeScript e Vite). O preview local usou banco temporário e mostrou os saldos de Mel e Thor. Nenhum dado do banco de desenvolvimento foi alterado nesta etapa.

Registro para ata — 29/09/2026: integrada a visualização de saldo de assinaturas na área do tutor. Próximo passo sugerido: revisar a experiência visual com o grupo e, depois, considerar histórico de consumo para funcionários/donos.

Etapa 6 concluída em 29/09/2026: Calebe definiu cotas separadas por serviço, blocos desde a contratação, extras do Plus 1 vez por ciclo, cancelamento liberando uso e falta consumindo. Migração `c83f9e205d16` aplicada localmente. Backup: `backend/instance/petlify-before-c83f9e205d16-20260929-232533.db`. Criados limites em plan_benefits e cópias contratadas em subscription_limits; módulo quotas.py; validação em criação/alteração/reativação; consulta GET /api/subscriptions/<id>/usage; proteção contra exclusão ou alteração de consumo concluído; textos dos catálogos atualizados. Código sincronizado com PetLify-Copia após comparação para não sobrescrever trabalho divergente.

Guia e registro para ata: `docs/cotas-dos-planos.md`. Próximo passo: mostrar saldo por serviço/período na interface. As alterações desta etapa seguem para a mesma branch `codex/banco-assinaturas-integridade`; conferir o histórico Git para o commit publicado.

Estado mais recente — etapa 5: revisão `b72e8d194c05` aplicada localmente em 24/09/2026. Pagamentos validam cliente do agendamento ou tutor do pet da assinatura. Campo novo `payments.pet_id`; checkout e desvinculação ao excluir pet atualizados. Corrigido autoflush de pagamento avulso com valor ainda vazio. Quatorze testes passaram. Backup anterior: `backend/instance/petlify-before-b72e8d194c05.db`. Ver `docs/integridade-pagamentos.md`.

O envio autorizado foi concluído em 29/09/2026 na branch `codex/banco-assinaturas-integridade`, preservando a pasta `PetLify/` do repositório. A cópia Git está em `../github-publicacao`. A versão remota de origem correspondia ao ZIP recebido (ignorando quebras de linha); arquivos ocultos de configuração ausentes foram incluídos. O push foi confirmado pelo Git e a comparação ficou visível no GitHub.

Publicação confirmada em 30/09/2026: o commit `5f8ce01` da tela de saldo foi enviado após o bloqueio anterior por limite do aprovador automático. Na conferência final, o GitHub confirmou o pull request #1 como integrado à main, com esse commit. Os registros de publicação feitos depois da integração permanecem na branch de trabalho.
https://github.com/calebecastro-5g/PetLify-MVP/pull/1

Esta retomada atualiza somente o registro de publicação. Build TypeScript/Vite e verificação visual da etapa 7 foram feitos anteriormente; os 22 testes do backend pertencem à validação da etapa 6. Não houve nova alteração de código. O agente enviou os commits e verificou a integração; não executou o merge.

Registro para ata — 29/09/2026: publicadas as cinco migrações, catálogo/assinaturas, proteções de integridade e documentação. Validação anterior: 14 testes em SQLite. Integração na main e implantação permanecem pendentes.

As cotas propostas na etapa 5 foram definidas e implementadas na etapa 6 acima. Pagamentos reais, concorrência de compras e deploy persistente continuam pendentes. Não há tarefa atribuída ao Claude. Os guias por etapa complementam o documento Word anterior.

Estado mais recente — etapa 4 concluída: revisão `a4b62c819f03` aplicada localmente em 24/09/2026. Agendamentos agora exigem tutor correto e assinatura do próprio pet via chaves compostas. Doze testes passaram. Conteúdo completo das 11 tabelas comparado ao backup `backend/instance/petlify-before-a4b62c819f03.db`, sem alteração de dados. Ver `docs/integridade-tutor-assinatura.md`. Troca de tutor com agendamentos existentes é bloqueada e precisará de regra própria se virar funcionalidade.

Próximo passo a combinar: reforçar o vínculo exato do pagador com agendamento/assinatura ou definir cotas com o grupo. Não há tarefa atribuída ao Claude. O documento Word continua anterior a estas etapas; os guias Markdown contêm os adendos para ata.

Atualização da etapa 3: a proteção de mesma loja descrita abaixo foi implementada em `73032ec89a26` e aplicada localmente. Veja `docs/integridade-entre-lojas.md`. São nove chaves compostas, ativação de foreign_keys nas conexões SQLite e verificação do legado. Dez testes passaram em 24/09/2026. O backup anterior está em `backend/instance/petlify-before-73032ec89a26.db`. Contagens das 11 tabelas foram preservadas e foreign_key_check não encontrou violações.

A correspondência exata de tutor e pet proposta nesta etapa 3 foi concluída na etapa 4 acima.

Proposta anterior, concluída nesta etapa: fortalecer a integridade entre lojas no banco e verificar a ativação das chaves no SQLite.

Antes de alterar, revisar modelos, migrações e rotas de exclusão. Desenhar as restrições, explicar a solução ao estudante e criar uma nova migração. Testar tentativas de vincular tutor, pet, assinatura e agendamento de lojas diferentes, além dos fluxos válidos. Não reescrever migrações já aplicadas como substituto de uma nova revisão.

## Ao encerrar cada etapa

Atualizar este arquivo com arquivos modificados, decisões, comando e resultado de testes, pendências e próximo passo. Ler o estado real dos arquivos antes de retomar; o registro pode ficar desatualizado se outra ferramenta já trabalhou.
