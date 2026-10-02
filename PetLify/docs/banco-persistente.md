# Passo 4 — Banco persistente gratuito

Registro de 02/10/2026. **Passo 4 concluído:** projeto Neon criado/migrado, Render conectado e publicado, jornada verificada, dados preservados após reinício e backup com os novos registros restaurado em PostgreSQL local separado. Próxima etapa: verificações automáticas no GitHub, conforme o [roteiro](ROTEIRO.md).

Publicado no [PR #4, em rascunho](https://github.com/calebecastro-5g/PetLify-MVP/pull/4), branch `codex/banco-persistente`, código de persistência no commit `6fa54a9`. Primeira implantação aprovada com `05b7ab7`. Depende do PR #3, que depende do #2. Nenhum merge realizado; conferir/ajustar a base após integrar as etapas anteriores. A descrição e o estado de rascunho do PR ainda precisam ser atualizados; os commits/documentos registram os resultados atuais.

## Decisão e possibilidade de pagar depois

Calebe definiu: “Precisamos de uma opção gratuita”. Também perguntou: “assim que tivermos caixa, conseguirermos alterar pra um banco pago?”.

A opção preparada é **PostgreSQL no Neon Free**, com aplicação no Render. Manter PostgreSQL permite aumentar o plano do mesmo provedor ou transferir os dados para outro PostgreSQL. Não é necessário reescrever as telas por causa dessa troca.

Condições consultadas em 02/10/2026 no [site oficial do Neon](https://neon.com/pricing): gratuito sem prazo fixo e sem cartão; 1 GB de armazenamento e 100 CU-h por projeto/mês; suspensão do processamento após cinco minutos sem atividade, com dados persistentes. O histórico gratuito de restauração tem janela curta, de até seis horas ou 1 GB de alterações. Esses limites podem mudar. CU-h mede capacidade de processamento multiplicada pelo tempo de uso; não é uma contagem de agendamentos.

Os planos pagos do Neon cobram conforme o uso. O valor deve ser conferido quando houver orçamento. Outra alternativa é Supabase, também com PostgreSQL; seu [plano gratuito](https://supabase.com/pricing) tem 500 MB e pode pausar por inatividade. O PostgreSQL gratuito do Render [expira após 30 dias](https://render.com/docs/free), por isso não foi escolhido para guardar o trabalho do grupo a longo prazo.

Gratuito não elimina a necessidade de backups. O Render Free continua podendo suspender a aplicação; separar o banco preserva os dados durante reinícios/reimplantações do aplicativo.

## O que mudou no código e por quê

1. `requirements.txt` inclui Psycopg 3.3.6, o driver que conecta Python ao PostgreSQL. A instalação binária evita exigir compilador local.
2. `config.py` reconhece URLs `postgres://` e `postgresql://` e seleciona `postgresql+psycopg://`. Mantém senha codificada e parâmetros de SSL. SQLite continua disponível no desenvolvimento.
3. Produção exige `DATABASE_URL` explícita e rejeita SQLite. Isso evita retornar silenciosamente ao arquivo efêmero `/tmp/petlify.db`.
4. O pool PostgreSQL tem duas conexões por processo, sem conexões extras. `pool_pre_ping` verifica conexões reaproveitadas; conexão inicial tem limite de espera de 15 segundos. Cada worker Gunicorn tem seu próprio pool.
5. `flask --app app database-check` consulta conexão, revisão Alembic e presença das tabelas, sem alterar dados nem imprimir credenciais. `--connection-only` permite verificar um banco antes das migrações.
6. `render-start.sh` verifica conexão, aplica migrações e verifica o esquema antes de iniciar Gunicorn. `render.yaml` pede a URL como segredo (`sync: false`) e usa `rootDir: PetLify`, conforme o repositório atual.
7. `database_backup.py` executa `pg_dump`/`pg_restore`. Não sobrescreve backups existentes e só restaura em destino vazio. A restauração é uma transação única e não usa `--clean` para apagar tabelas.
8. `.gitignore` também exclui arquivos de backup e arquivos `.env`. Não publicar conexões reais no GitHub nem colocar senhas em variáveis `VITE_*`: elas entram no JavaScript entregue ao navegador.

Nenhum modelo ou arquivo de migração anterior foi alterado. A revisão permanece `c83f9e205d16`. O SQLite local não foi transferido nem alterado. A configuração externa realizada nesta atualização está registrada abaixo.

## Estado real da configuração em 02/10/2026

Calebe criou a conta Neon e informou que o Render está em Ohio. O endereço público foi confirmado no painel: [PetLify publicado](https://petlify-mvp.onrender.com). Também confirmou: **“Apenas demonstração; pode começar vazio”**, permitindo começar sem copiar os cadastros do SQLite publicado.

| Item | Resultado verificado |
| --- | --- |
| Projeto Neon | PetLify, Free, AWS US East 2 (Ohio) |
| Branch e banco | `production` (padrão), banco `petlify` |
| Servidor PostgreSQL | 18.6, informado pela conexão; a preparação local usou 18.4 |
| Conexão | Direta, sem pooling do Neon; parâmetros `sslmode=require` e `channel_binding=require` preservados |
| Proteção da conexão | TLS 1.3 confirmado pelo cliente `psql` com os mesmos parâmetros |
| Migrações | Seis aplicadas até `c83f9e205d16`; repetição de `upgrade` sem alteração adicional |
| Esquema | Sem diferenças entre modelos e banco; `database-check` aprovado; 12 tabelas de domínio e `alembic_version` |
| Dados antes da jornada | 3 planos, 5 serviços e 9 benefícios inseridos pelas migrações; zero lojas, usuários, pets, assinaturas e agendamentos |
| Backup | `pg_dump` do Neon concluído; restaurado em PostgreSQL local temporário separado, comparando integralmente as 13 tabelas |
| Origem após recuperação | Nova conexão confirmou os mesmos registros no Neon; nenhum seed executado |
| Render na criação do Neon | Free, Ohio, branch `main`, commit `84911c6`, conexão SQLite; posteriormente atualizado conforme a validação abaixo |

O [painel do projeto Neon](https://console.neon.tech/app/projects/delicate-morning-01044204/branches/br-divine-mud-b4vqt065/tables?database=petlify) mostra as tabelas. Nenhum plano pago ou serviço opcional foi ativado. Outro projeto já existente na conta não foi alterado.

Evidências privadas locais, fora do repositório: `neon-validacao-20261002.json`, capturas em `evidencias-persistencia-20261002` e backup `.private-persistence/backups/petlify-neon-inicial-20261002.dump`. Não colocar credenciais, arquivos de ambiente ou backups no GitHub.

O backup inicial contém apenas catálogo e versão. Um segundo backup, descrito abaixo, inclui os cadastros da jornada publicada e também foi restaurado. Novas gravações exigem novos backups.

### Troca realizada no Render

O código em `main` ainda não contém o driver e as verificações desta etapa. A troca combinou o código preparado, a URL secreta em `DATABASE_URL` e `SEED_DEMO=false`.

Calebe recebeu a explicação sobre Render, Neon, variáveis e deploy e autorizou: **“certo, pode prosseguir”**. Foi publicada a branch `codex/banco-persistente`, que contém as etapas dos PRs #2, #3 e #4, no serviço existente PetLify-MVP. Nenhum PR foi integrado e a `main` não foi alterada. Depois da revisão e dos merges na ordem combinada, conferir o commit integrado e retornar o Render à `main`.

A URL com senha foi guardada somente na configuração secreta do Render, sem publicá-la no código, conversa ou capturas. As demais credenciais do serviço foram preservadas. Auto-Deploy já estava em **On Commit** e foi mantido; novos commits nesta branch podem iniciar outra publicação.

### Validação da implantação e fechamento do passo 4

1. **Compilação:** dependências Python, Psycopg e build TypeScript/Vite instalados/compilados pelo Render. Root Directory continua `PetLify`; build/start permanecem `bash render-build.sh` / `bash render-start.sh`.
2. **Correção da configuração:** a primeira publicação compilou, mas recusou iniciar porque o campo secreto ainda entregava SQLite. A edição feita enquanto o valor estava oculto não o substituiu. Foi aberto apenas o campo da conexão, editado seu valor, conferida a correspondência com a URL Neon e salva nova publicação. `SEED_DEMO=false` também foi conferido. A proteção de produção evitou iniciar com SQLite; nenhum modelo ou código precisou mudar.
3. **Inicialização aprovada:** deploy `dep-db01q5tg1s2s73c8hsd0`, commit `05b7ab7`, Live em 02/10/2026 às 18h09 de São Paulo. Logs: “Conexão OK.”, revisão/tabelas aprovadas e Gunicorn ativo. Endpoint `/api/health` aprovado.
4. **Jornada pela API publicada:** criada uma loja separada, **Loja QA Persistência (demonstração)**, com dono/tutor fictícios e um pet. Nenhum CPF, telefone, aceite de termos ou dado pessoal real usado. Compra PIX simulada do Básico criou pagamento/assinatura. Reserva em 04/10/2026 às 08h voltou com `-03:00`; segundo banho bloqueado por cota; cancelamento liberou uso e nova reserva foi aceita. Nenhum pagamento real realizado.
5. **Conferência na interface:** login de QA na área do cliente mostrou pet, plano, saldo, pagamento simulado e reservas cancelada/pendente. Recarregar diretamente `/cliente` também funcionou.
6. **Reinício real do Render:** ação Restart service; logs mostraram nova execução às 18h12–18h13, com conexão/revisão/tabelas novamente aprovadas e novo worker. Novo login consultou pet, pagamento, assinatura, dois agendamentos e saldo: comparação integral dos retornos com os anteriores, sem diferenças. A interface recarregada mostrou os mesmos registros.
7. **Prova da origem dos dados:** consulta direta ao Neon confirmou IDs e vínculos criados pela API do Render. Os dados não estavam sendo gravados em um SQLite separado.
8. **Segundo backup:** `petlify-neon-apos-render-20261002.dump` gerado por `pg_dump` e restaurado em PostgreSQL local temporário vazio. Comparação integral das 13 tabelas aprovada; segunda restauração sobre destino preenchido recusada; nova inserção no destino validou a sequência de IDs. Nenhuma restauração sobre o banco publicado.

No segundo backup: 1 loja, 2 usuários, 1 pet, 1 pagamento, 1 assinatura, 2 limites contratados, 2 agendamentos, 15 registros de auditoria, 3 planos, 5 serviços e 9 benefícios. Vacinas vazias; revisão Alembic preservada. Os registros de QA estão identificados como demonstração e permaneceram no Neon. O seed automático continua desligado; o grupo pode cadastrar sua própria loja separada pela tela de cadastro.

Evidências locais fora do Git: `render-validacao-20261002.json`, capturas `render-deploy-neon-aprovado.jpg` e `petlify-apos-reinicio.jpg` em `evidencias-persistencia-20261002`, além do segundo backup privado. Esta validação não configura backups automáticos, não verifica restauração em outro serviço de nuvem e não integra PRs. A etapa 5 fará as verificações automáticas; revisão/integração dos PRs continua na ordem #2 → #3 → #4.

## Como reproduzir a validação local

Na pasta `backend`, com dependências instaladas:

```powershell
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -W ignore::DeprecationWarning -m unittest discover -s tests -v
..\.venv\Scripts\python.exe -W ignore::DeprecationWarning validate_postgres.py --pg-bin "C:\Program Files\PostgreSQL\18\bin"
```

O último comando precisa dos executáveis PostgreSQL; informe a pasta correta se a instalação estiver em outro lugar. Usa uma pasta temporária, senha aleatória e porta livre em `127.0.0.1`. Não aceita uma URL externa, não registra serviço no Windows e não acessa `backend/instance/petlify.db`. Encerra o servidor e remove o ambiente temporário ao concluir normalmente.

### Resultados reais em PostgreSQL 18.4

As 13 verificações do script passaram:

- Aplicação das seis migrações e repetição de `upgrade` sem divergência entre esquema e modelos.
- Comando de verificação da implantação aprovado.
- Compra simulada cria pagamento e assinatura; reserva retorna horário com fuso da loja.
- Segundo banho no mesmo bloco bloqueado pela cota.
- Chave estrangeira rejeita cliente de outra loja; API não expõe sua agenda.
- Cancelamento libera uso; duas requisições simultâneas disputando o último uso produzem 201 e 409.
- Reinício do PostgreSQL preserva os dados.
- Backup nativo restaurado em banco separado: comparação integral das 13 tabelas, incluindo as vazias, sem diferença nos registros.
- Segunda restauração sobre esse destino é recusada, preservando os registros.
- Sequências de IDs restauradas permitem inserir uma nova loja sem colisão.

O teste inicial de captura de saída travou no Windows; o cluster temporário foi encerrado e o script passou a usar arquivos de log para os comandos de inicialização. A execução corrigida concluiu normalmente.

Esses resultados validam PostgreSQL local. Não certificam latência, limites, permissões, pooling e TLS do Neon, nem uma implantação ainda não realizada.

Suíte de backend: **39 testes aprovados** (32 anteriores e 7 novos de configuração e verificação de implantação). O comando de verificação mantém registros/revisão intactos, rejeita revisão desatualizada e oculta credenciais em erros. Frontend não foi alterado neste passo; as verificações do passo 3 permanecem registradas no guia correspondente.

## Conectar à nuvem, passo a passo

1. Calebe cria/acessa sua conta no [Neon](https://console.neon.tech). Escolher **Free**, criar projeto do grupo e usar PostgreSQL 18 se oferecido. Se a versão for outra, validar nela antes de adotar. Não contratar plano pago nesta etapa.
2. Abrir **Connect**, escolher banco/branch corretos e copiar a URL PostgreSQL. Para este MVP pequeno, começar com **Connection pooling desativado**: a conexão direta atende também migrações e backups. Preservar `sslmode=require` e `channel_binding=require` fornecidos pelo painel.
3. Com a confirmação específica de Calebe, guardar a URL no campo secreto `DATABASE_URL` do serviço Render. Não colar a senha em conversa, arquivo versionado ou captura de tela. Para ferramentas de backup, usar `DATABASE_BACKUP_URL` com a URL direta do banco correspondente, em ambiente privado.
4. Publicar o código preparado junto com a conexão: validar a branch `codex/banco-persistente` conforme a opção acima ou integrar primeiro os PRs na ordem registrada em CONTINUIDADE.md. Não realizar merges automaticamente. No Render manual, **Root Directory: PetLify**; build `bash render-build.sh`; start `bash render-start.sh`. Para Blueprint, informar o caminho `PetLify/render.yaml` no repositório atual.
5. Manter `SEED_DEMO` desligado para preservar dados. Migrações inserem o catálogo, mas não criam contas demo. Cadastrar a primeira loja pela aplicação. Executar seed apenas em banco de demonstração separado.
6. Conferir os logs: conexão OK, seis migrações/revisão atual, 12 tabelas OK e Gunicorn ativo. Validar saúde e jornada de cadastro, pet, compra simulada e reserva.
7. Reiniciar/reimplantar o serviço Render e conferir a permanência dos registros. Fazer backup e restaurar em outro banco **vazio**, nunca sobre o banco em uso. Conferir dados, IDs e jornada no destino.

A URL contém senha. A [documentação de conexão do Neon](https://neon.com/docs/connect/connect-from-any-app) mostra como obtê-la. Os testes locais usaram conexões sem TLS somente em loopback; na nuvem manter TLS e conferir proteção/identidade do servidor conforme o provedor.

### Atenção aos dados SQLite existentes

Trocar `DATABASE_URL` conecta a outro banco; não copia o conteúdo do SQLite. O banco local foi preservado. Antes da adoção, o grupo deve definir quais registros são apenas demonstração e quais precisam ser transferidos. Dados a preservar exigem exportação/importação própria, validando tipos, enums, vínculos entre lojas, IDs, datas e sequências. Não existe importador SQLite → PostgreSQL nesta entrega; `pg_dump` não lê arquivos SQLite.

## Backup e restauração sem expor a senha

Na pasta `backend`, com `DATABASE_BACKUP_URL` configurada privadamente em `.env` ou no ambiente:

```powershell
# Origem: conexão direta do banco que será copiado.
..\.venv\Scripts\python.exe database_backup.py backup ..\backups\petlify-20261002.dump --pg-bin "C:\Program Files\PostgreSQL\18\bin"

# Destino: alterar DATABASE_BACKUP_URL para outro banco vazio antes de restaurar.
..\.venv\Scripts\python.exe database_backup.py restore ..\backups\petlify-20261002.dump --pg-bin "C:\Program Files\PostgreSQL\18\bin"
```

Use ferramentas de versão compatível: `pg_dump` não deve ser mais antigo que o servidor de origem; mantenha PostgreSQL da mesma versão ou uma versão posterior compatível no destino e teste antes da troca. Veja [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) e [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).

Backup contém os dados privados do sistema. Armazenar fora do Git em local protegido, com cópia fora do computador; acesso apenas aos responsáveis do grupo. Como ponto de partida do MVP, fazer backup em dias com alterações importantes e sempre antes de migrações. Periodicidade, retenção e responsável definitivo devem ser decididos pelo grupo. Backup só foi demonstrado quando sua restauração também foi conferida. Não foi criada rotina automática nesta entrega.

## Quando houver caixa

**Mesmo projeto/provedor:** conferir preço e limites, fazer backup validado, autorizar a contratação e aumentar o plano no painel. Continuar com PostgreSQL e verificar conexão, cadastros, pagamentos simulados e reservas depois da mudança. É aumento de capacidade/serviço; não significa redesenhar as tabelas. Confirmar eventuais mudanças de endpoint no painel.

**Outro provedor PostgreSQL:** criar destino compatível; testar restauração de um backup recente; programar breve pausa das gravações; gerar backup final; restaurar no destino; conferir registros e sequências; atualizar `DATABASE_URL` no Render; implantar e validar. Preservar a origem e os backups até a aceitação. Se for necessário voltar depois de novas gravações no destino, reconciliar esses registros antes: simplesmente voltar a URL perderia as alterações recentes.

**Outra tecnologia, por exemplo MySQL:** planejar uma migração diferente, incluindo revisão dos tipos e das migrações. É possível, mas exige mais trabalho que continuar com PostgreSQL.

## Texto para ata/comunicação com o grupo

Em 02/10/2026, foi concluído o passo 4 do PetLify. Foi criado o projeto Neon Free PetLify em Ohio, banco petlify, branch production, PostgreSQL 18.6, com seis migrações aplicadas e TLS conferido. Com autorização de Calebe, o Render passou a usar a conexão Neon e a branch codex/banco-persistente, sem merges e com SEED_DEMO=false. A primeira tentativa recusou SQLite; o campo secreto foi corrigido e a publicação aprovada. Uma loja fictícia separada validou cadastro, compra simulada, reserva, cota e cancelamento. Reinício do Render preservou integralmente os registros e o saldo, também conferidos na interface e diretamente no Neon. Backup com os novos registros foi restaurado em PostgreSQL local separado, comparando as 13 tabelas e validando sequências de IDs. SQLite local preservado; nenhuma contratação paga ou cobrança real realizada. Próximo passo: automatizar verificações no GitHub. Backups automáticos, restauração em outro serviço de nuvem e integração dos PRs permanecem fora desta validação.
