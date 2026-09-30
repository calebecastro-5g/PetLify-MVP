# Integridade de tutor e assinatura — etapa 4

Registro de 24/09/2026. Revisão `a4b62c819f03`, após `73032ec89a26`.

## Passo 1 — identificar a regra

Estar na mesma loja não basta. Se Ana e Bruno usam a mesma loja, um agendamento do pet de Ana não deve registrar Bruno como seu cliente. Mesmo dois pets de Ana precisam usar suas próprias assinaturas.

## Passo 2 — representar a regra no banco

Foram adicionadas duas chaves estrangeiras compostas em `appointments`:

| Origem | Destino | Garantia |
| --- | --- | --- |
| pet_id, client_id, store_id | pets.id, pets.owner_id, pets.store_id | O cliente é o tutor cadastrado do pet |
| subscription_id, pet_id, store_id | subscriptions.id, subscriptions.pet_id, subscriptions.store_id | A assinatura pertence ao pet agendado |

Os trios de destino receberam restrições de unicidade para serem referenciáveis. As chaves da etapa anterior permanecem. `subscription_id` pode continuar nulo em um agendamento avulso.

Exemplo: o pet 20 tem tutor 10 e loja 1. O agendamento precisa referenciar `(20, 10, 1)`. O trio `(20, 11, 1)` é rejeitado mesmo que o usuário 11 pertença à loja 1.

## Passo 3 — migrar sem inventar correções

A migração verifica todos os agendamentos antes de alterar tabelas. Se encontrar incompatibilidade, informa o ID do agendamento e se o problema está no tutor ou na assinatura. A correção deve considerar os dados reais; nenhuma associação é corrigida automaticamente.

O banco local recebeu um backup em `backend/instance/petlify-before-a4b62c819f03.db`. A migração foi aplicada e os conteúdos completos das 11 tabelas de domínio foram comparados com o backup: permaneceram iguais. A revisão técnica em `alembic_version` mudou conforme esperado. A aplicação de chaves está ativa e `foreign_key_check` não encontrou violações.

## Passo 4 — verificar casos reais

Os 12 testes passaram em SQLite, incluindo os dez anteriores e dois novos testes com vários cenários:

- Alterar diretamente o cliente para outro tutor da mesma loja é rejeitado.
- Usar assinatura de outro pet do mesmo tutor é rejeitado.
- Trocar pet, tutor ou pet da assinatura de modo a invalidar um agendamento existente é rejeitado.
- Inserir um agendamento com tutor ou assinatura incompatível é rejeitado.
- Agendar o segundo pet com sua própria assinatura continua funcionando.
- Dados antigos inválidos interrompem a migração antes de criar restrições; a revisão anterior e a configuração de chaves são preservadas. Após corrigir os dados no banco de teste, a migração funciona.

O teste existente de correspondência entre esquema e modelos também passou. Os testes usam arquivos temporários separados; nenhum downgrade foi executado no banco local do usuário.

Na pasta `backend`:

```powershell
..\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## Consequências e limites

Trocar o tutor de um pet com agendamentos existentes passa a ser bloqueado. Uma futura transferência de tutela deve definir o significado histórico de `client_id` antes de alterar essa regra. A implementação atual trata o cliente do agendamento como tutor cadastrado, não como qualquer pessoa autorizada a pagar.

Estas chaves não verificam validade temporal, benefício ou quantidade de usos: essas regras precisam de lógica adicional. As regras de mesma loja em pagamentos continuam, mas a correspondência exata entre pagador, agendamento e assinatura ainda merece uma etapa própria. Nenhuma integração financeira real foi adicionada.

Validação feita em SQLite local. Outro banco e o deploy não foram testados nesta etapa. Alterações ainda não enviadas ao GitHub.

## Arquivos e registro para o grupo

- `backend/models.py`: duas chaves compostas e duas restrições únicas.
- `backend/migrations/versions/a4b62c819f03_appointment_ownership.py`: nova revisão com verificação prévia e reversão.
- `backend/tests/test_subscriptions.py`: cenários de tutor e assinatura incorretos dentro da mesma loja.
- Este guia e `docs/CONTINUIDADE.md`: registro e passagem entre ferramentas.

Texto para ata: Em 24/09/2026, o banco passou a exigir que o cliente de um agendamento seja o tutor do pet e que a assinatura utilizada pertença ao mesmo animal. A migração verifica inconsistências anteriores e foi aplicada localmente após backup. Doze testes passaram, e a comparação das 11 tabelas confirmou preservação dos dados. A etapa não incluiu publicação ou deploy.
