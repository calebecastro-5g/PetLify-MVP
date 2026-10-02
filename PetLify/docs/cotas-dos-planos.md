# Cotas dos planos — etapa 6

Data: 29/09/2026. Regras definidas por Calebe nesta conversa; implementação no backend e catálogo.

## 1. Regras confirmadas

| Plano | Banho | Tosa | Extras |
| --- | --- | --- | --- |
| Básico | 1 por bloco de 15 dias | 1 por bloco de 15 dias | Não incluídos |
| Premium | 1 por bloco de 7 dias | 1 por bloco de 7 dias | Não incluídos |
| Premium Plus | 2 por bloco de 7 dias | 2 por bloco de 7 dias | Hidratação, corte de unha e limpeza de ouvido: 1 de cada por ciclo de 30 dias |

As cotas são separadas: um banho não consome a cota de tosa.
Os blocos começam na data e hora de início da assinatura, e não na segunda-feira ou no primeiro dia do mês.
Agendamentos pendentes e confirmados reservam uso; concluídos e faltas consomem; cancelados não contam.
Um cancelamento aceito libera uso. A regra existente de seis horas para cancelamento pelo cliente permanece.

O ciclo continua com 30 dias. Nos planos semanais, há quatro blocos completos e um bloco final de dois dias, com cota normal. Isso permite até 5 banhos e 5 tosas no Premium, ou 10 de cada no Plus, distribuídos pelos blocos. Esse efeito foi informado durante a implementação.

Não há acúmulo de saldo entre blocos. Não há intervalo mínimo móvel entre atendimentos: dois usos podem ficar próximos à fronteira de blocos.
Se a assinatura começa no dia 1 às 10h, o segundo bloco semanal começa no dia 8 às 10h. O instante final de um bloco pertence ao próximo; o fim da assinatura é exclusivo.

## 2. O que mudou no banco

Migração nova: c83f9e205d16, após b72e8d194c05. As cinco revisões anteriores foram preservadas.

- plan_benefits recebe max_uses (quantidade) e period_days (duração do bloco).
- subscription_limits guarda uma cópia desses valores para cada serviço de uma assinatura.
- A chave composta (subscription_id, service_id) impede duplicar uma regra para o mesmo serviço.
- Chaves estrangeiras exigem assinatura e serviço existentes; CHECK exige quantidade e período positivos.
- Compra e seed capturam os limites na criação da assinatura.

A cópia dos limites preserva as condições contratadas mesmo se o catálogo mudar.
Assinaturas criadas manualmente precisam capturar seus limites; sem configuração, não recebem cobertura ilimitada.

Os agendamentos existentes são a fonte da contagem; não foi criado um contador redundante. Isso evita manter dois saldos potencialmente divergentes.
A contagem é filtrada por assinatura, loja, pet, serviço, intervalo e status.

## 3. Como a API aplica a regra

Na criação de agendamento pelo plano, a API valida cobertura e saldo.
Se a cota estiver esgotada, responde HTTP 409 com code=subscription_quota_exceeded e uma mensagem; não cria pagamento nem converte automaticamente em avulso.

Remarcações e trocas de serviço/cobrança validam o destino e excluem o próprio registro da contagem.
Se a alteração falhar, o agendamento anterior permanece.
Reativar um cancelado também exige cota e horário disponíveis.

Uma atualização apenas de status mantém o vínculo histórico: concluir um atendimento não exige que sua assinatura continue vigente.
Atendimentos pelo plano com status Concluído ou Falta não permitem modificar data, serviço ou cobrança, evitando apagar o consumo por uma remarcação.
Para excluir individualmente um agendamento pelo plano, é preciso cancelá-lo primeiro.
A exclusão física de pet/conta continua removendo dependências conforme o MVP; a política de preservação integral do histórico é uma etapa futura.

A nova compra continua substituindo a assinatura anterior. Agendamentos anteriores preservam o vínculo original; novos usos utilizam a nova assinatura. Não há transferência automática de reservas entre assinaturas.

## 4. Concorrência

Antes de contar usos para uma gravação, o backend adquire um bloqueio de escrita na assinatura por UPDATE, mantido até commit ou rollback.
Assim, duas requisições pela API não decidem simultaneamente que o último uso está livre.
O teste de concorrência usa duas conexões/requisições: uma reserva é aceita e a outra recebe 409.

Esta proteção foi validada em SQLite. Não representa certificação de PostgreSQL/MySQL, carga elevada ou da lotação global da loja entre assinaturas diferentes.
As cotas são uma regra transacional da API: SQL direto ou scripts que gravem agendamentos sem esse fluxo podem ultrapassá-las. As chaves estrangeiras sozinhas não expressam limites por período.

## 5. Consulta de saldo

GET /api/subscriptions/<id>/usage
GET /api/subscriptions/<id>/usage?at=2026-10-01T10:00:00

Exige JWT e aplica autorização de loja/tutor.
A data opcional escolhe o bloco; sem data, usa o instante atual. Data fora da vigência recebe 400.
A resposta contém subscription_id, status e services. Cada serviço inclui:
service, limit, used, remaining, period_starts_at e period_ends_at.

Exemplo de item: banho com limit=1, used=1 e remaining=0 significa que o uso daquele bloco já foi reservado ou consumido.
Consultar uma assinatura substituída permite inspecionar uso histórico; o saldo não autoriza uma nova reserva nessa assinatura.
A consulta não reserva vaga. A decisão final acontece na gravação.

O catálogo do frontend e do backend foi reescrito para esclarecer as cotas separadas e ciclos.
A área do cliente exibe saldo no cartão do pet e no formulário de agendamento, consultando o período da data selecionada. Desde 02/10/2026, agenda/consulta sem offset usa o horário de São Paulo; timestamps de assinatura/blocos incluem Z (UTC). As conversões preservam as fronteiras de tempo decorrido, conforme [datas-e-horarios.md](datas-e-horarios.md).

## 6. Migração do legado

A migração copia as regras para todas as assinaturas existentes e preserva os agendamentos.
Reservas antigas contam quando estão dentro do bloco consultado e não estão canceladas.
Se um bloco já exceder a cota, nenhum atendimento é cancelado automaticamente: o saldo exibido é zero e novos usos naquele bloco são bloqueados.
Não há criação de pagamentos ou cancelamentos retroativos.

Antes de aplicar a uma base compartilhada, fazer backup e revisar eventuais excessos com o grupo.
A migração reversa remove as configurações de cotas; também exige voltar o código à versão compatível.

## 7. Validação e continuidade

O frontend da área do cliente agora exibe o saldo por serviço no cartão de cada pet e no formulário de agendamento. Ao informar a data/horário, a tela consulta o bloco correspondente; a API continua sendo a fonte final da decisão. A tela não reserva uso apenas por consultar o saldo.

A suíte testa: migrações/modelos; dados legados; limites separados; fronteiras de períodos; extras; bloco final; cancelamento; falta; reativação; remarcação sem duplicidade; rollback; preservação do consumo; saldo autorizado; cópia contratada e reservas concorrentes, além das regressões anteriores.

Comando, a partir de backend:
```powershell
..\.venv\Scripts\python.exe -W ignore::DeprecationWarning -m unittest discover -s tests -v
```

Na cópia Git sem ambiente virtual, usar o Python do ambiente de PetLify-Copia.
A revisão final e a aplicação local estão registradas em CONTINUIDADE.md.

## Registro para ata

Em 29/09/2026, Calebe definiu cotas separadas para banho e tosa, blocos desde a contratação, extras do Plus uma vez por ciclo, cancelamento liberando uso e falta consumindo.
Foram implementados os limites no banco/API, consulta de saldo e testes de regressão e concorrência. O catálogo foi atualizado para explicar a regra.
A tela de saldo foi concluída na etapa 7. A jornada foi validada no passo 2 e os horários foram corrigidos no passo 3 do roteiro. Próximo: persistência gratuita, conforme ROTEIRO.md.
