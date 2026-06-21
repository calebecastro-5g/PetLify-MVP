# Petlify MVP

Sistema web acadêmico para gestão de pet shops. O MVP centraliza cadastro de clientes e pets, agenda, carteira de vacinação, planos, checkout, equipe e resumo financeiro.

## O que mudou nesta versão

Esta versão foi ajustada com base no documento de estruturação do projeto:

- identidade visual mais clean, moderna, leve e com predominância de azul claro;
- navegação lateral com menu por área;
- áreas separadas para Cliente, Funcionário e Dono;
- área Meu Perfil / Editar Perfil em todos os perfis;
- campos de CPF, telefone, espécie do pet e plano mensal;
- central de notificações do cliente para vacinas;
- busca operacional de pets por tutor, CPF, pet ou raça;
- carteira de vacinação com validade, veterinário e lote;
- painel financeiro do dono com receita e pagamentos;
- auditoria básica para ações importantes;
- preparação para deploy no Render;

## Tecnologias

- Frontend: React + TypeScript + Vite
- Backend: Python + Flask
- Banco local do MVP: SQLite
- ORM: SQLAlchemy
- Autenticação: JWT
- Senhas: Bcrypt
- Deploy: Render

## Como abrir pelo terminal

Use dois terminais.

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

O frontend fica em:

```text
http://localhost:3000
```

## Usuários de teste

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Cliente | cliente@petlify.dev | Dev@123456 |
| Funcionário | funcionario@petlify.dev | Dev@123456 |
| Dono | dono@petlify.dev | Dev@123456 |

As contas `@petlify.dev` entram direto para facilitar a demonstração do MVP.

## Áreas do sistema

### Cliente

O cliente consegue editar o próprio perfil, cadastrar pets, marcar agendamentos, visualizar a carteira de vacinação, acompanhar notificações de vacina e acessar o checkout pelo carrinho.

### Funcionário

O funcionário consegue editar seu perfil, visualizar a agenda do dia ou a agenda completa, buscar pets por tutor/CPF, conferir planos dos pets e registrar vacinas na carteirinha digital.

### Dono

O dono consegue editar seu perfil e o nome da loja, ver o resumo operacional, cadastrar funcionários, ativar/desativar acessos, acompanhar pagamentos, receita, agenda recente e logs de auditoria.

### Checkout

O checkout permite registrar planos e serviços avulsos com PIX, Cartão de Crédito ou Dinheiro. Pagamento em dinheiro exige senha de funcionário ou dono.

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

### Opção recomendada: Blueprint

1. Suba este projeto para um repositório no GitHub.
2. No Render, escolha New > Blueprint.
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

O backend Flask servirá também o frontend compilado. Por isso, depois do deploy, o sistema abre em uma única URL do Render.

### Opção manual: Web Service

Configurações principais:

```text
Runtime: Python
Build Command: bash render-build.sh
Start Command: bash render-start.sh
```

Variáveis de ambiente:

```text
FLASK_ENV=production
DATABASE_URL=sqlite:///instance/petlify.db
CORS_ORIGINS=*
SECRET_KEY=gerar-no-render
JWT_SECRET_KEY=gerar-no-render
BCRYPT_LOG_ROUNDS=12
```

## Banco de dados

Para a primeira fase, o projeto usa SQLite para facilitar a execução local e o deploy demo.

Configuração local:

```text
DATABASE_URL=sqlite:///instance/petlify.db
```

Para evolução futura, o sistema continua preparado para banco relacional via SQLAlchemy. Exemplo com MySQL externo:

```text
DATABASE_URL=mysql+pymysql://usuario:senha@host/petlify_db
```

## Observações importantes

- Este é um MVP acadêmico.
- O 2FA real por e-mail ainda não está integrado a um serviço de e-mail.
- A recuperação de senha existe como fluxo de MVP, mas ainda não envia e-mail real.
- O Google Login ainda é apenas visual/planejado.
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
