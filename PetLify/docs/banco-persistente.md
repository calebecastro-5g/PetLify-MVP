# Passo 4 — Banco persistente gratuito

Registro de 02/10/2026. Preparação e validação local concluídas; conexão com Neon e implantação no Render ainda pendentes. A etapa permanece em andamento no [roteiro](ROTEIRO.md).

Publicado no [PR #4, em rascunho](https://github.com/calebecastro-5g/PetLify-MVP/pull/4), branch `codex/banco-persistente`, commit `6fa54a9`. Depende do PR #3, que depende do #2. Nenhum merge realizado; conferir/ajustar a base após integrar as etapas anteriores.

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

Nenhum modelo ou arquivo de migração anterior foi alterado. A revisão permanece `c83f9e205d16`. Não foi feita transferência de dados locais nem configuração de serviços externos.

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
3. Guardar a URL no campo secreto `DATABASE_URL` do serviço Render. Não colar a senha em conversa, arquivo versionado ou captura de tela. Para ferramentas de backup, usar `DATABASE_BACKUP_URL` com a URL direta do banco correspondente, em ambiente privado.
4. Integrar os PRs na ordem registrada em CONTINUIDADE.md antes de implantar a branch escolhida. No Render manual, **Root Directory: PetLify**; build `bash render-build.sh`; start `bash render-start.sh`. Para Blueprint, informar o caminho `PetLify/render.yaml` no repositório atual.
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

Em 02/10/2026, foi preparada a persistência do PetLify com PostgreSQL e opção gratuita Neon, mantendo caminho de evolução para planos pagos. Foram adicionados driver, configuração de conexão, verificação de implantação e ferramentas de backup/restauração. Produção passou a exigir banco externo. As seis migrações, cotas, isolamento por loja, disputa pelo último uso, permanência após reinício e restauração integral foram verificados em PostgreSQL 18.4 temporário. O banco local foi preservado. A conexão Neon/Render, a decisão sobre transferência de dados SQLite e a validação da implantação permanecem pendentes; nenhuma contratação foi realizada.
