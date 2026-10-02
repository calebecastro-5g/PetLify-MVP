# Datas e horários — passo 3 do roteiro

Registro de 02/10/2026 para Calebe e o grupo de Engenharia de Software.

## Problema encontrado

A compra usava UTC, mas o navegador interpretava a resposta sem fuso como hora do computador. A assinatura aparecia com três horas de diferença. A agenda recebia horários da loja e comparava esses valores diretamente com UTC. Além disso, a API removia offsets de entrada sem converter o instante, e a edição de vacina preenchia o campo com a hora em UTC.

Um exemplo ajuda a entender: em 02/10/2026, `09:00-03:00` em São Paulo e `12:00Z` representam o mesmo instante. `Z` indica UTC. Retirar `-03:00` ou `Z` não transforma um horário no outro; a conversão precisa acontecer antes.

## Contrato adotado

Todas as lojas deste MVP usam `America/Sao_Paulo`. O fuso do computador ou servidor não deve decidir a hora da loja.

| Campo | Significado e armazenamento atual | Resposta da API |
| --- | --- | --- |
| Pagamento: created_at, confirmed_at | Instante em UTC, sem tzinfo na coluna existente | ISO-8601 com Z |
| Assinatura: starts_at, ends_at | Instante em UTC, sem tzinfo na coluna existente | ISO-8601 com Z |
| Auditoria: timestamp; outros created_at | Instante em UTC, sem tzinfo na coluna existente | Auditoria com Z; outros campos não expostos mantêm o contrato interno |
| Agendamento: scheduled_at | Horário local da loja, sem tzinfo na coluna existente | ISO-8601 com offset de São Paulo |
| Vacina: applied_at, valid_until | Horário local da loja, sem tzinfo na coluna existente | ISO-8601 com offset de São Paulo |
| Horário oferecido em appointment-slots | Valor para o formulário: YYYY-MM-DDTHH:mm | Sem offset no value; timezone=America/Sao_Paulo no objeto da resposta |

As colunas `DateTime` existentes continuam iguais. Não foi criada uma migração para regravar os dados. A aplicação agora documenta o significado de cada coluna e converte ao passar entre contratos.

Entrada de agenda/vacina sem offset significa hora da loja. Entrada com offset ou Z representa um instante e é convertida para São Paulo antes de guardar. Por exemplo, tanto `2026-10-03T09:00` quanto `2026-10-03T12:00:00Z` guardam `2026-10-03 09:00` na agenda.

Datas de nascimento continuam sendo datas de calendário; este passo não as transforma em instantes.

## Alterações realizadas, passo a passo

1. Criado `backend/time_utils.py` com relógios UTC/local, conversões, leitura de entrada e serialização explícita. Adicionada a dependência `tzdata==2026.4` para disponibilizar as regras IANA também no Windows.
2. Modelos passam a indicar o fuso nas respostas. Defaults de criação e o prazo do 2FA usam o relógio UTC centralizado.
3. Agenda de hoje compara horários com o relógio da loja. Cancelamento/exclusão convertem o agendamento para UTC antes de avaliar as seis horas.
4. Vigência e cotas convertem o horário escolhido para UTC. A consulta ao banco converte os limites UTC do bloco para o horário local da coluna de agendamento.
5. Alertas de vacina comparam horários locais. Novos dados de agenda/vacina do seed usam hora local; compras/assinaturas demo continuam em UTC.
6. Criado `frontend/src/lib/dates.ts`, usado pelos painéis de cliente, funcionário e dono e pelo saldo. Exibição, edição, filtro de hoje e mês do financeiro usam São Paulo, independentemente do computador.
7. Formulários de vacina/agendamento são preenchidos com a hora da loja. O horário ainda não enviado do formulário tem um formatador próprio, pois ele já é um valor local, sem offset.
8. Testes anteriores passam a indicar explicitamente quando seus dados de entrada são UTC. Adicionados testes de API e testes dos formatadores com dispositivos em UTC e Tóquio.

## Como a regra do plano funciona agora

Uma contratação às 09h da loja é guardada como 12h UTC no exemplo acima. O segundo bloco do Básico começa 15 dias depois desse instante. A hora local escolhida para atendimento é convertida para UTC antes de localizar o bloco.

Ao contar reservas, a aplicação converte início/fim do bloco para o contrato local da coluna `scheduled_at`. Assim, um atendimento não muda de bloco por uma diferença acidental de três horas.

Início é inclusivo; fim é exclusivo. Um atendimento exatamente no início do segundo bloco pertence ao segundo bloco. A assinatura continua com 30 dias de tempo decorrido, e blocos com 7 ou 15 dias de tempo decorrido; não seguem semanas ou meses do calendário. As regras de quantidade e status não foram alteradas.

## Tratamento do legado

Preservados os valores das colunas existentes e a hora de agenda/vacina que já era exibida no MVP. Compras, assinaturas e auditoria antigas seguem sua origem UTC; sua exibição passa a converter corretamente.

Limitação conhecida: entradas antigas com offset tiveram esse offset removido pelo código anterior. Sem guardar a origem, não é possível reconstruir com certeza a intenção desses registros. O seed anterior também misturava origens. A política deste passo preserva a hora local já exibida para agenda/vacina; não tenta adivinhar ou deslocar todos os registros antigos. Casos específicos devem ser revisados com o grupo antes de qualquer correção de dados.

Para horários históricos ambíguos de transição de fuso, não há informação de `fold` no legado; a interpretação padrão do ZoneInfo é usada. Atender lojas em outros fusos ou alterar esse contrato exige uma nova decisão de modelagem e tratamento do legado; não basta trocar uma constante.

## Validação concluída

| Verificação | Resultado |
| --- | --- |
| Suíte completa do backend | 32 testes aprovados em bancos SQLite temporários migrados: 24 anteriores + 8 novos |
| Testes de frontend | 14 aprovados: 7 cenários em cada um dos fusos de dispositivo UTC e Asia/Tokyo |
| Build TypeScript/Vite | Aprovado após a última correção |
| Migrações/modelos | Continuam compatíveis na revisão c83f9e205d16 |
| Valores legados | Teste confirma que serializar agenda/vacina/assinatura não regrava seus valores |
| Navegador: vacina | Editar, salvar apenas lote e reabrir preservou aplicação 02/09/2026 01:00 e validade 02/09/2027 01:00 |
| Navegador: compra simulada | Contratação de Luna às 01:16 locais; histórico e início do saldo mostram 02/10/2026 01:16, vencimento 01/11/2026 01:16 |
| Navegador: reserva e edição | Luna, banho em 03/10/2026 08:00; editar/salvar manteve 08:00 e um único uso reservado |

Os testes novos cobrem offsets equivalentes, ida e volta pela API, vigência inclusiva/exclusiva, fronteira exata de cota, consulta de saldo, horários de hoje, seis horas para cancelamento/exclusão, vacinação e preservação do legado. Os de frontend cobrem edição, meia-noite, mês do financeiro e exibição do horário ainda no formulário.

O navegador revelou uma falha durante a implementação: o saldo tentava tratar o horário local ainda no formulário como timestamp de API. Ela foi corrigida com `formatShopInput`, recebeu teste e o fluxo foi repetido com sucesso.

Preview executado com `backend/preview_journey.py`, banco descartável separado de `backend/instance/petlify.db`. O banco de desenvolvimento não recebeu seed, compras nem agendamentos de QA. Evidências locais em `evidencias-horarios-20261002/` na pasta de trabalho, fora do Git.

## Como reproduzir

No backend da cópia executável:

```powershell
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -W ignore::DeprecationWarning -m unittest discover -s tests -v
```

No frontend, após instalar as dependências do projeto:

```powershell
npm.cmd run test:dates
npm.cmd run build
```

Para QA manual, a partir de backend, usar o preview temporário e abrir http://127.0.0.1:5056:

```powershell
..\.venv\Scripts\python.exe preview_journey.py --port 5056
```

Na cópia Git, o caminho do Python pode apontar para a `.venv` da cópia executável. Reiniciar o servidor após atualizar dependências/código e recarregar a página após compilar o frontend.

## Referência técnica

A biblioteca padrão [ZoneInfo do Python](https://docs.python.org/3/library/zoneinfo.html#data-sources) documenta o uso de dados IANA do sistema ou de tzdata e recomenda declarar tzdata para aplicações que precisam funcionar em plataformas como Windows. Essa é a razão da nova dependência.

## Registro para ata e próximo passo

Em 02/10/2026, foram corrigidos o contrato de datas, as comparações de vigência/cotas e seis horas, a agenda de hoje e a edição/exibição de horários nos painéis. Os registros antigos foram preservados conforme sua origem e as limitações do legado foram documentadas. Validação: 32 testes de backend, 14 de frontend, build e verificação manual no navegador aprovados.

Passo 3 do roteiro concluído. Próximo: passo 4, banco persistente. Calebe definiu em 02/10/2026: **“Precisamos de uma opção gratuita”**. Não há serviço externo configurado ou contratado neste passo; destino, migrações no banco escolhido e backup/restauração ainda precisam ser preparados e validados.

Publicação: commit `f173150`, branch `codex/datas-horarios`, [PR #3](https://github.com/calebecastro-5g/PetLify-MVP/pull/3) aberto em 02/10/2026. Ele usa a branch do [PR #2](https://github.com/calebecastro-5g/PetLify-MVP/pull/2) como base para isolar este passo. Revisar/integrar #2 primeiro; depois conferir/ajustar a base de #3 para main antes de integrá-lo. Ambos permanecem abertos; não houve merge automático.
