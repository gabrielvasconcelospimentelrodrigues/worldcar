# World Car Service

Landing page e sistema de gestão da World Car Service — lava a jato, estética
automotiva, funilaria e revitalização, em Curitiba/PR.

- **Site público** em `/` — serviços, tabela de preços, programa de fidelidade e
  contato por WhatsApp.
- **Sistema interno** em `/sistema` — orçamentos, ordens de serviço, vistorias,
  compras, financeiro, folha de pagamento, fidelidade e relatórios.

---

## Onde está o código

O sistema em uso é a **SPA em [`web/`](web/)**: React 19 + Vite + TypeScript +
Tailwind 4, falando direto com o Supabase, sem back-end próprio.

A pasta raiz ainda guarda a **primeira versão em Next.js**, mantida apenas como
histórico. Ela não recebe mais alterações, e o `schema.prisma` dela **não é mais
a fonte de verdade** do banco — quem manda é [`supabase/migracoes/`](supabase/migracoes/).
Há um script de guarda que recusa `db:push`, `db:migrate` e `db:deploy`
justamente porque rodá-los hoje apagaria tabelas que o Prisma não conhece
(autenticação, folha, fidelidade, entre outras). Ver [`prisma/AVISO.md`](prisma/AVISO.md).

```
web/                 sistema e site (é aqui que se trabalha)
  src/telas/         telas
  src/componentes/   componentes reutilizáveis
  src/lib/           acesso a dados, formatação, regras de tela
  src/pdf/           documentos em PDF (orçamento, OS, vistoria, cotação, relatório)
supabase/migracoes/  esquema do banco — fonte de verdade
supabase/mock.mjs    gera um ano de operação fictícia para demonstração
prisma/, src/        versão Next.js antiga (histórico)
```

---

## Rodando

```bash
cd web
npm install
cp .env.example .env.local   # preencha com os dados do seu projeto Supabase
npm run dev
```

O banco se aplica da raiz, com as migrações em ordem:

```bash
npm install
node supabase/aplicar.mjs        # aplica tudo
node supabase/aplicar.mjs 015    # aplica só a migração 015
```

---

## Variáveis de ambiente

**Este repositório é público. Nenhum valor real entra aqui** — `.env*` está no
`.gitignore`, e só os arquivos `.env.example`, que contêm apenas os nomes das
variáveis, são versionados.

Para rodar a SPA (`web/.env.local`) bastam duas:

| Variável | Para quê |
| --- | --- |
| `VITE_SUPABASE_URL` | endereço do projeto |
| `VITE_SUPABASE_ANON_KEY` | chave anônima |

As duas são públicas por natureza: viajam no pacote que o navegador baixa. Quem
protege os dados é a **RLS** — as políticas em
[`supabase/migracoes/002_rls.sql`](supabase/migracoes/002_rls.sql) e as funções
`SECURITY DEFINER` que concentram as regras de dinheiro dentro do Postgres, fora
do alcance do navegador.

As variáveis da raiz (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`AUTH_SECRET`) servem às migrações e à versão antiga. **Essas são segredo de
verdade e ficam apenas na máquina de quem administra** — não vão para a Vercel,
porque a SPA não tem servidor que as usaria.

---

## Publicando na Vercel

A SPA é um site estático. Na Vercel:

- **Root Directory**: `web`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Variáveis**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

É preciso também uma reescrita para que as rotas internas funcionem ao recarregar
a página — sem ela, abrir `/sistema/ordens` direto no navegador dá 404, porque não
existe esse arquivo no servidor; quem resolve a rota é o React.

> O `vercel.json` na raiz ainda aponta para a versão Next.js antiga e **não serve**
> para a SPA.

---

## Verificação

```bash
cd web
npm run build
npx tsc --noEmit -p tsconfig.app.json
npx oxlint src

# exercita todos os cadastros pelo caminho real do navegador, RLS inclusa
TESTE_EMAIL=... TESTE_SENHA=... node verificar-cadastros.mjs
```

---

## Dados de demonstração

```bash
node supabase/mock.mjs            # gera um ano de operação
node supabase/mock.mjs --limpar   # apaga só o que foi gerado
```

Todo registro criado pelo gerador tem `id` começando por `mk-`, o que torna a
limpeza exata: nada de apagar tabela inteira e levar junto cadastro real.
