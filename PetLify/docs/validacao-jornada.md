# Validação da jornada e consolidação — 30/09/2026

Registro para o grupo e para uma ata. Corresponde aos passos 1 e 2 de [ROTEIRO.md](ROTEIRO.md).

## Objetivo e ambiente

Consolidar os guias com a versão integrada pelo PR #1 e conferir a jornada do cliente pela interface, do cadastro ao uso do plano.
As verificações usaram Flask servindo o build do React em `http://127.0.0.1:5056`, com SQLite temporário.
O banco de desenvolvimento em `backend/instance/petlify.db` não foi usado para cadastrar os dados de QA.
Tutor Jornada QA, Pipoca QA e Paçoca QA são dados fictícios. PIX foi apenas um registro simulado do MVP.

O novo comando `backend/preview_journey.py` cria um banco descartável, aplica as seis migrações, prepara as duas lojas demo e inicia o servidor somente em 127.0.0.1.
O banco não deve ser usado como armazenamento do projeto: cada execução começa uma demonstração nova.

Na cópia executável, a partir de `backend`:

```powershell
..\.venv\Scripts\python.exe preview_journey.py --port 5056
```

O frontend precisa estar compilado com `npm run build` antes de abrir a demonstração. As credenciais fictícias são as de `seed_dev.py`.

## Passo 1 — Consolidação

- Criada a branch `codex/consolidacao-validacao`, incorporando `origin/main` (84911c6) e preservando os registros posteriores ao PR #1.
- Atualizados README, continuidade, guia do banco, cotas, integridade entre lojas e roteiro de colaboração.
- Corrigidas descrições que ainda tratavam cotas, consulta de saldo e integridade já implementadas como futuras.
- Confirmado o esquema com 12 tabelas de domínio e seis migrações, na revisão c83f9e205d16.
- Salva a ordem aprovada para os seis próximos passos em ROTEIRO.md.
- Comparados os arquivos modificados com a versão anterior antes da sincronização com PetLify-Copia.

Os registros históricos por etapa permanecem nos guias correspondentes e no Git. CONTINUIDADE.md descreve o estado atual para a retomada por Calebe ou outra ferramenta.

## Passo 2 — Resultados pela interface

| Verificação | Resultado observado |
| --- | --- |
| Cadastro de novo tutor | Cadastro concluído e painel aberto. A tentativa inicial com CPF já existente mostrou a validação; depois foi usado um identificador fictício diferente. |
| Cadastro do pet | Pipoca QA apareceu sem assinatura; Paçoca QA foi acrescentado para comparar o layout com/sem plano. |
| Contratação | Compra simulada do Básico para Pipoca QA criou pagamento e assinatura, com um banho e uma tosa disponíveis separadamente. |
| Primeira reserva | Banho em 02/10/2026 às 08:00 foi criado; saldo passou a zero para banho e permaneceu um para tosa. |
| Cota esgotada | Segundo banho no mesmo bloco foi recusado com HTTP 409 e mensagem de limite esgotado; a agenda manteve somente a reserva inicial. |
| Cancelamento | Cancelamento do primeiro atendimento, com antecedência superior a seis horas, manteve o registro como Cancelado e devolveu o banho. |
| Nova reserva | Banho em 04/10/2026 às 08:00 foi aceito usando a cota devolvida. |
| Edição | Horário alterado para 09:00; a reserva continuou contando uma única vez, sem exigir uma segunda cota. |
| Data fora da vigência | Consulta de saldo para novembro exibiu “Data fora da vigência da assinatura”. |
| Computador | Cartões com e sem assinatura verificados em 1280 × 900; após o ajuste, o cartão sem plano manteve a altura natural. |
| Celular | Menu, cartões/saldo e catálogo do checkout verificados em 390 × 844; textos e botões visíveis, sem transbordamento horizontal nessas páginas. |
| Segunda loja | Após sair do Centro e entrar como Cliente Maria, o painel mostrou apenas Mimi e Nina, com seus atendimentos, pagamentos e vacinas. Luna, Mel e Thor não apareceram. |
| Recarregamento | Após corrigir o servidor, `/cliente` abriu diretamente e o painel Maria continuou correto após atualizar a página. |

Durante a automação, o preenchimento do campo nativo de data exigiu uma edição por teclado para disparar o evento de mudança. Também foi necessário reconectar a aba após uma interrupção no diálogo de confirmação. Isso foi tratado como limitação da interação automatizada; as ações foram verificadas pela tela e pelas respostas do servidor.

## Correções encontradas nesta validação

### 1. Abrir ou atualizar uma rota do React retornava 404

O Flask registrava uma rota automática de arquivos estáticos em `/<path:path>`, além da rota que deveria servir o React. A primeira interceptava `/cliente`, `/dono`, `/funcionario` e `/checkout`, procurando arquivos com esses nomes.
Agora `serve_frontend` é o responsável por servir arquivos e a entrada `index.html` das rotas React. Endpoints desconhecidos em `/api` e arquivos ausentes em `/assets` continuam retornando 404.

Dois testes de regressão cobrem links diretos/recarregamento e a distinção entre HTML, arquivos e API. Antes da correção, o teste de rotas falhou nos quatro caminhos internos; depois, a suíte completa passou.

### 2. Cartão de pet sem plano ficava esticado

A grade igualava a altura dos cartões. O pet sem saldo ganhava grandes espaços entre os textos e botões quando ficava ao lado de um pet com assinatura.
O alinhamento da grade passou a usar o início da linha, permitindo a altura natural de cada cartão.

### 3. Checkout descrevia o preço como “por mês”

O catálogo do checkout passou a mostrar “por ciclo de 30 dias”, consistente com a validade real da assinatura e com a área do cliente.

## Verificações técnicas

- `python -m unittest discover -s tests -v`: **24 testes aprovados**, em bancos temporários. Inclui os 22 testes anteriores de integridade/cotas e os dois novos testes de encaminhamento.
- `npm run build`: **TypeScript e Vite aprovados**, com os ajustes de interface.
- As seis migrações foram aplicadas nas bases temporárias; nenhuma nova migração de banco foi necessária nesta etapa.
- Acesso direto e recarregamento do painel confirmados no navegador após a correção.
- Capturas locais: pasta `evidencias-jornada-20260930`, ao lado de `github-publicacao`, com `pets-desktop.jpg` e `saldo-celular.jpg`. Não contêm dados reais e não são necessárias para executar o projeto.

## Limites e próximo passo

A jornada principal foi validada. A inspeção móvel não representa testes em todos os aparelhos/navegadores, e a troca de loja pela tela complementa os testes de autorização da API; não substitui uma auditoria de segurança.

O teste encontrou a pendência do passo 3: uma contratação feita aproximadamente às 09:12 no fuso de São Paulo apareceu como 12:12. Compras/assinaturas usam instantes UTC sem indicação de fuso; agendamentos recebem horários locais também sem fuso. `parse_datetime` ainda remove offsets sem converter o instante.
Antes de migrar qualquer horário antigo, precisamos separar essas origens e definir o contrato de entrada, armazenamento e exibição. Não houve conversão de dados nesta etapa.

Persistência externa, verificações automáticas no GitHub e histórico operacional da equipe seguem nos passos 4, 5 e 6. Pagamentos reais e renovação automática permanecem fora desta validação.

## Texto para ata ou atualização do grupo

> Em 30/09/2026, foi registrada a ordem de evolução do PetLify e consolidada a documentação com o esquema atual de 12 tabelas. A jornada de cadastro, assinatura simulada, agendamento, bloqueio de cota, cancelamento e remarcação foi validada em uma base temporária. Foram corrigidos o acesso direto às rotas da aplicação, o alinhamento dos cartões de pets e a indicação do ciclo de 30 dias no checkout. A suíte passou com 24 testes, e a interface compilou. O próximo passo é padronizar datas e horários antes da configuração do banco persistente.
