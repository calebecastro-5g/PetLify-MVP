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
- serviços avulsos com tabela fixa da plataforma;
- identidade visual clean, moderna e com predominância de azul claro;
- área Meu Perfil / Editar Perfil em Cliente, Funcionário e Dono;
- painel do Dono com tabela fixa, receita, pagamentos, equipe e auditoria;
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

O cliente consegue editar o próprio perfil, cadastrar pets, marcar agendamentos, visualizar a carteira de vacinação, acompanhar notificações de vacina e acessar o checkout pelo carrinho. Ao criar conta, ele é vinculado a um Pet Shop específico.

### Funcionário

O funcionário consegue editar seu perfil, visualizar a agenda do dia ou a agenda completa, buscar pets por tutor/CPF, conferir planos dos pets e registrar vacinas na carteirinha digital. Ele só acessa os dados da loja à qual pertence.

### Dono

O Dono consegue cadastrar o próprio Pet Shop, editar dados da loja, ver resumo operacional, cadastrar funcionários, ativar/desativar acessos, acompanhar pagamentos, receita, agenda recente e logs de auditoria. Cada Dono vê apenas os dados do seu Pet Shop.

### Checkout

O checkout registra planos mensais e serviços avulsos com PIX, Cartão de Crédito ou Dinheiro. Pagamento em dinheiro exige senha de funcionário ou dono. O backend valida os itens pela tabela oficial da plataforma, evitando valores personalizados por loja.

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
