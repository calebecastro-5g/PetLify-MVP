# Integridade de pagamentos — etapa 5

24/09/2026. Revisão `b72e8d194c05`, após `a4b62c819f03`.

## O que mudou e por quê

O campo `payments.client_id` identifica o cliente responsável pela compra no MVP. Agora, um pagamento vinculado a agendamento deve ter o mesmo cliente do atendimento. Um pagamento vinculado a assinatura deve identificar o pet dessa assinatura e seu tutor. Estar na mesma loja não era suficiente para garantir essas correspondências.

Foi adicionado `payments.pet_id`, opcional para pagamentos sem assinatura, e três chaves compostas:

- `(appointment_id, client_id, store_id)` referencia o agendamento e seu cliente.
- `(pet_id, client_id, store_id)` referencia o pet e seu tutor.
- `(subscription_id, pet_id, store_id)` referencia a assinatura e seu pet.

A restrição `subscription_id IS NULL OR pet_id IS NOT NULL` impede deixar o pet vazio para contornar a verificação de uma assinatura. Pagamentos históricos sem vínculo continuam permitidos.

## Fluxos atualizados

O checkout preenche o pet ao comprar assinatura. Ao excluir um pet, o fluxo existente desvincula pet e assinatura do pagamento, preservando o registro financeiro. Transferências de tutor com esses vínculos exigirão política explícita de histórico.

Um teste adicional revelou que o pagamento avulso podia disparar salvamento automático antes do preenchimento do valor. O preço agora é consultado antes de colocar o pagamento novo na sessão. Isso evita a tentativa de inserir `amount` nulo.

O cliente aqui é o responsável registrado pela compra, não a identificação bancária de quem efetuou uma transferência. Pagamentos por terceiros e integração financeira real continuam fora deste fluxo.

## Migração

A nova revisão verifica pagamentos antigos antes de modificar tabelas. Se encontrar cliente incompatível, informa o ID do pagamento e interrompe. Para pagamentos já ligados a assinaturas, preenche `pet_id` a partir da assinatura existente, sem inventar compras ou valores.

Foi criado o backup local `backend/instance/petlify-before-b72e8d194c05.db` antes do upgrade. As contagens das 11 tabelas foram preservadas; a verificação de chaves estrangeiras não encontrou violações.

## Testes

Os 14 testes passaram em SQLite. Os dois novos testes cobrem, entre outros cenários:

- Compra avulsa válida pela API e exclusão posterior do agendamento com preservação do pagamento.
- Rejeição de alterações por SQL que trocam cliente, pet ou assinatura por referências incompatíveis.
- Rejeição de assinatura vinculada a pagamento sem pet.
- Interrupção da migração quando o pagamento antigo usa o cliente errado.
- Preenchimento do pet na migração após corrigir o registro de teste.

Os demais testes continuam verificando esquema, migrações anteriores, cobertura, vencimento, compra, exclusão de pet e isolamento de lojas. A validação não cobre outro banco, pagamentos reais ou deploy.

## Arquivos alterados nesta etapa

`backend/models.py`, `backend/api.py`, `backend/tests/test_subscriptions.py`, nova migração em `backend/migrations/versions/b72e8d194c05_payment_ownership.py`, este guia e `docs/CONTINUIDADE.md`.

## Registro para ata

Em 24/09/2026, foi reforçada a correspondência entre cliente, pagamento, agendamento e assinatura por restrições no banco. O checkout passou a registrar o pet da assinatura no pagamento e recebeu correção na ordem de consulta do preço para serviços avulsos. A migração foi aplicada localmente após backup, preservando as contagens dos registros. Quatorze testes passaram em SQLite.
