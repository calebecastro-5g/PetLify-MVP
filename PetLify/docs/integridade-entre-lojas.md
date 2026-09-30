# Integridade entre lojas — etapa 3

Registro de 24/09/2026. Migração `73032ec89a26`, posterior a `1d532c0cfeb8`.

## 1. O problema

Uma chave estrangeira simples como `pets.owner_id -> users.id` verifica se o tutor existe. Ela não verifica que o tutor pertence à loja do pet. Filtros na API ajudam, mas importações e scripts também podem escrever no banco.

## 2. A regra no banco

Agora existe também a referência composta `(owner_id, store_id) -> users(id, store_id)`. O banco precisa encontrar o par completo. Se o usuário 10 pertence à loja 1, um pet da loja 2 não pode apontar para ele.

As tabelas referenciadas receberam restrições únicas em `(id, store_id)`. Embora `id` já seja único, declarar o par permite usá-lo explicitamente como destino da chave estrangeira composta. Os IDs e relacionamentos antigos foram preservados.

| Origem | Referência que exige a mesma loja |
| --- | --- |
| Pet | Tutor |
| Assinatura | Pet |
| Agendamento | Cliente, pet e assinatura opcional |
| Pagamento | Cliente, confirmador opcional, agendamento opcional e assinatura opcional |

São nove restrições compostas. Referências opcionais podem continuar nulas. As vacinas herdam o contexto da loja pelo pet. O identificador do ator na auditoria permanece sem chave estrangeira, como antes.

## 3. Particularidade do SQLite

Em cada conexão SQLite aberta pelo SQLAlchemy, `PRAGMA foreign_keys=ON` ativa a aplicação das chaves estrangeiras. Uma ferramenta externa que abra o arquivo diretamente também precisa ativar essa opção; o arquivo sozinho não força a configuração de todas as conexões externas.

Durante migrações, o Alembic pode reconstruir tabelas referenciadas. O executor desativa temporariamente essa verificação apenas na conexão de manutenção, confere as referências antes e depois e restaura a opção no encerramento. Não executar migrações simultaneamente com alterações de dados por outra ferramenta.

## 4. Como proteger os dados antigos

A nova migração verifica as nove relações antes de criar restrições. Se houver um vínculo incompatível, ela para com tabela, coluna e ID do registro. Ela não escolhe uma loja automaticamente nem apaga registros para concluir.

Antes de aplicar no banco local, foi criado `backend/instance/petlify-before-73032ec89a26.db` pela API de backup do SQLite. A migração foi aplicada e as contagens das 11 tabelas de domínio foram comparadas ao backup. Não houve diferença nas contagens; `foreign_key_check` retornou vazio.

## 5. Verificação

Os dez testes passaram. Além dos sete anteriores, foram acrescentados:

- SQL direto tenta modificar nove referências e mover usuário/pet para outra loja; o banco rejeita. Uma inserção inválida de pet também é rejeitada.
- Exclusão de pet com assinatura e agendamento mantém o pagamento desvinculado sem violar referências.
- Migração de dados antigos inconsistentes para antes de alterar o esquema, mantém a versão anterior e restaura a aplicação das chaves.

O teste existente de migração também percorre downgrade e upgrade em banco temporário. Não foi feito downgrade do banco local do usuário.

Comando, dentro de `backend`:

```powershell
..\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## 6. Arquivos alterados

- `backend/models.py`: restrições compostas, pares únicos e relações ORM explícitas.
- `backend/extensions.py`: ativação das chaves no SQLite.
- `backend/migrations/env.py`: manutenção das tabelas e verificação de referências.
- `backend/migrations/versions/73032ec89a26_enforce_same_store_references.py`: nova migração e verificação do legado.
- `backend/api.py`: junção explícita entre assinaturas e pets para evitar ambiguidade com as novas chaves.
- `backend/tests/test_subscriptions.py`: três testes adicionais.
- `docs/CONTINUIDADE.md` e este guia: passagem de contexto e registro didático.

## 7. Limites e próximos passos

Este guia registra a etapa 3. Nas etapas 4 e 5, os vínculos exatos de tutor/pet/assinatura e de pagamentos também foram implementados. Os testes usam SQLite; outro banco precisa de validação antes de deploy.

Cotas e concorrência na última cota foram implementadas na etapa 6; saldo do cliente na etapa 7. A revisão atual é c83f9e205d16 e o PR #1 foi integrado à main. Pagamentos reais, concorrência de compras/lotação geral, catálogo duplicado, fuso e retenção continuam pendentes; seguir ROTEIRO.md.

## Texto para registro do grupo

Em 24/09/2026, foram adicionadas nove chaves estrangeiras compostas para impedir vínculos entre lojas diferentes em pets, assinaturas, agendamentos e pagamentos. A aplicação passou a exigir chaves estrangeiras nas conexões SQLite. A migração verifica inconsistências anteriores, e um backup precedeu sua aplicação local. Dez testes passaram, incluindo tentativas de inserção e alteração inválidas por SQL direto. As contagens de registros foram preservadas. A validação foi local, sem publicação no GitHub ou deploy.
