# Petlify MVP

Sistema web acadêmico para gestão de pet shops em modelo **SaaS multi-tenant**. O Petlify não foi estruturado para apenas uma loja: cada Dono pode cadastrar seu próprio Pet Shop, e os dados de clientes, pets, agenda, equipe e financeiro ficam isolados por loja.

## O que esta versão contempla

Esta versão foi ajustada conforme o documento atualizado do projeto:

- modelo SaaS multi-tenant, com entidade central de Pet Shop/loja;
- isolamento de dados por Pet Shop usando `store_id` em clientes, pets, agendamentos, pagamentos e auditoria;
- cadastro de Dono criando um novo Pet Shop;
- cadastro de Cliente vinculado a um Pet Shop existente;
- busca pública de Pet Shops para facilitar o vínculo do cliente;
- planos mensais fixos e iguais para todos os Pet Shops;
- serviços avulsos com tabela fixa da plataforma e compra dentro do fluxo de agendamento;
- identidade visual atualizada com base no logo oficial enviado no QA;
- área Meu Perfil / Editar Perfil em Cliente, Funcionário e Dono, com opção de desativar conta;
- painel do Dono com tabela fixa, receita, pagamentos, equipe e auditoria;
- histórico de compras para o Cliente;
- CRUD de pets e agendamentos para o Cliente;
- registro e edição/cancelamento de vacinas pelo Funcionário;
- preparação para deploy no Render.

## Tabela fixa da plataforma

Nenhum Pet Shop cria, renomeia ou altera planos nesta fase do MVP. Os valores são padronizados para toda a plataforma.

### Planos mensais

| Plano | Serviços inclusos | Valor |
| --- | --- | --- |
| Básico | Banho/tosa 1x a cada 15 dias | R$ 99,00/mês |
| Premium | Banho/tosa 1x por semana | R$ 189,00/mês |
| Premium Plus | Banho/tosa 2x por semana + hidratação + corte de unha + limpeza de ouvido | R$ 349,00/mês |

### Serviços avulsos

| Serviço | Valor |
| --- | --- |
| Banho | R$ 60,00 |
| Tosa | R$ 50,00 |
| Hidratação | R$ 40,00 |
| Corte de unha | R$ 20,00 |
| Limpeza de ouvido | R$ 20,00 |

## Tecnologias

- Frontend: React + TypeScript + Vite
- Backend: Python + Flask
- Banco local do MVP: SQLite
- ORM: SQLAlchemy
- Autenticação: JWT
- Senhas: Bcrypt
- Deploy: Render

## Como abrir localmente pelo terminal

Use dois terminais. Rode uma linha por vez.

### Terminal 1 — Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
.\venv\Scripts\python.exe seed_dev.py
.\venv\Scripts\python.exe -m flask run
```

O backend fica em:

```text
http://127.0.0.1:5000
```

### Terminal 2 — Frontend

```powershell
cd frontend
npm install
npm run dev
```

Se o PowerShell bloquear o `npm`, use:

```powershell
npm.cmd install
npm.cmd run dev
```

O frontend fica em:

```text
http://localhost:3000
```

## Usuários de teste

| Perfil | E-mail | Senha | Pet Shop |
| --- | --- | --- | --- |
| Cliente | cliente@petlify.dev | Dev@123456 | Petlify Centro |
| Funcionário | funcionario@petlify.dev | Dev@123456 | Petlify Centro |
| Dono | dono@petlify.dev | Dev@123456 | Petlify Centro |
| Dono extra | dono.maria@petlify.dev | Dev@123456 | Pet Shop da Maria |

As contas `@petlify.dev` entram direto para facilitar a demonstração do MVP.

## Áreas do sistema

### Cliente

O cliente consegue editar o próprio perfil, desativar a própria conta, cadastrar/editar/excluir pets, marcar/editar/cancelar/excluir agendamentos, visualizar a carteira de vacinação, acompanhar notificações de vacina, consultar o histórico de compras e acessar o checkout pelo carrinho. Os serviços avulsos são pagos a partir do fluxo de agendamento. Ao criar conta, ele é vinculado a um Pet Shop específico.

### Funcionário

O funcionário consegue editar seu perfil, visualizar a agenda do dia ou a agenda completa, buscar pets por tutor/CPF, conferir planos dos pets e registrar, editar ou cancelar vacinas na carteirinha digital. O responsável pela vacina é selecionado a partir da equipe cadastrada no Pet Shop. Ele só acessa os dados da loja à qual pertence.

### Dono

O Dono consegue cadastrar o próprio Pet Shop, editar dados da loja, ver resumo operacional, cadastrar funcionários, ativar/desativar acessos, acompanhar pagamentos, receita, agenda recente e logs de auditoria. Cada Dono vê apenas os dados do seu Pet Shop.

### Checkout

O checkout registra planos mensais com PIX, Cartão de Crédito ou Dinheiro. Pagamento em dinheiro exige senha de funcionário ou dono. Os serviços avulsos são exibidos para consulta, mas só podem ser pagos quando o cliente cria um agendamento. O backend valida os itens pela tabela oficial da plataforma, evitando valores personalizados por loja.

## Deploy no Render

Esta versão está preparada para subir como um único Web Service no Render. O backend Flask também entrega o frontend compilado, então o sistema fica em uma única URL pública.

Arquivos importantes:

```text
render.yaml
render-build.sh
render-start.sh
.python-version
.node-version
```

### Blueprint

1. Suba este projeto para um repositório no GitHub.
2. No Render, escolha **New > Blueprint**.
3. Conecte o repositório.
4. Confirme o serviço definido no `render.yaml`.
5. Aguarde o build.

O Render executará:

```bash
bash render-build.sh
```

E iniciará com:

```bash
bash render-start.sh
```

### Web Service manual

Configurações principais:

```text
Runtime: Python
Build Command: bash render-build.sh
Start Command: bash render-start.sh
```

Variáveis de ambiente recomendadas:

```text
FLASK_ENV=production
DATABASE_URL=sqlite:////tmp/petlify.db
CORS_ORIGINS=*
SECRET_KEY=gerar-no-render
JWT_SECRET_KEY=gerar-no-render
BCRYPT_LOG_ROUNDS=12
PYTHON_VERSION=3.11.11
NODE_VERSION=20.15.1
```

## Banco de dados

Para a primeira fase, o projeto usa SQLite para facilitar a execução local e o deploy demo.

Configuração local:

```text
DATABASE_URL=sqlite:///instance/petlify.db
```

Configuração usada no Render demo:

```text
DATABASE_URL=sqlite:////tmp/petlify.db
```

Para evolução futura, o sistema continua preparado para banco relacional via SQLAlchemy. Exemplo com MySQL externo:

```text
DATABASE_URL=mysql+pymysql://usuario:senha@host/petlify_db
```

## Observações importantes

- Este é um MVP acadêmico.
- O modelo multi-tenant já está representado no banco por Pet Shop/loja.
- O 2FA real por e-mail ainda não está integrado a um serviço de e-mail.
- A recuperação de senha existe como fluxo de MVP, mas ainda não envia e-mail real.
- O banco SQLite em ambiente gratuito de deploy é indicado para demonstração, não para produção final.
- Para produção real, recomenda-se usar banco persistente externo.

## O que não enviar para o GitHub

Não envie:

```text
backend/venv/
frontend/node_modules/
frontend/dist/
backend/instance/*.db
backend/.env
```

Esses itens já estão no `.gitignore`.

## Ajustes aplicados após QA 2.0

Esta versão reforça principalmente o fluxo de agendamento, conforme o segundo QA do grupo:

- a tela inicial ficou mais limpa e os cards inferiores foram removidos;
- o cadastro agora também permite informar data de nascimento;
- o perfil exibe a data de nascimento quando ela estiver cadastrada;
- a ação de conta agora é **Excluir conta**, não apenas desativar;
- o Dono cadastra apenas funcionários na tela de equipe;
- o Dono pode ativar/desativar e excluir funcionários;
- funcionários criados pelo Dono conseguem entrar com a senha inicial cadastrada;
- o 2FA do MVP exibe o código na tela, pois ainda não existe envio real por e-mail;
- cadastro de pet voltou a usar seleção de raça;
- planos não são aplicados gratuitamente no cadastro do pet: o plano é vinculado ao pet após pagamento no checkout;
- o agendamento agora permite escolher entre serviço coberto pelo plano do pet e serviço avulso;
- se o serviço estiver coberto pelo plano, não há pagamento no checkout;
- se o serviço for avulso, o fluxo direciona para pagamento;
- o sistema consulta horários disponíveis por dia;
- não é permitido criar dois agendamentos sobrepostos no mesmo Pet Shop;
- duração do horário depende do porte do pet: pequeno 30 minutos, médio 1 hora e grande 2 horas;
- pet shops diferentes podem ter agendamentos no mesmo horário, pois os dados são isolados por loja;
- cancelamento por cliente com menos de 6 horas pode exigir pagamento e é bloqueado quando ainda não existe pagamento associado;
- funcionário pode excluir pet pela busca operacional;
- registro de vacina usa automaticamente o funcionário logado como responsável, sem lista de outros responsáveis.

## Observação para subir no GitHub/Render

Ao enviar para o GitHub, envie o conteúdo desta pasta como raiz do repositório. A tela inicial do GitHub deve mostrar diretamente:

```text
backend/
frontend/
render-build.sh
render-start.sh
render.yaml
README.md
```

No Render, deixe:

```text
Root Directory: vazio
Build Command: bash render-build.sh
Start Command: bash render-start.sh
```
