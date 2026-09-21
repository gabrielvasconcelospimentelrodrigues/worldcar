# Este schema não é mais a fonte da verdade

O `schema.prisma` deste diretório descreve o **app Next legado**, na raiz do
repositório. O sistema em uso é o SPA em [`../web/`](../web/), que fala direto
com o Supabase.

Desde a migração, a estrutura do banco é definida por
[`../supabase/migracoes/`](../supabase/migracoes/) — arquivos `.sql` numerados,
aplicados com:

```bash
node supabase/aplicar.mjs        # tudo
node supabase/aplicar.mjs 004    # só o 004
```

## Por que os comandos `db:push` e `db:migrate` foram desativados

O banco tem **6 tabelas que o `schema.prisma` desconhece**:

- `perfis` — liga o login ao funcionário e define o papel; **a autenticação depende dela**
- `fornecedores`, `cotacoes`, `cotacao_itens`, `cotacao_fornecedores`, `cotacao_precos`

Além de 38 políticas de RLS e 14 funções que o Prisma também não enxerga.

`prisma db push` sincroniza o banco **com o schema**, o que significa que ele
apagaria tudo isso — e o sistema pararia de autenticar. Por isso os scripts
agora recusam e apontam para cá.

## O que ainda funciona

- `npm run db:studio` — navegador visual do banco, só leitura útil
- `npx prisma generate` — gera o client para os scripts de manutenção que ainda
  usam Prisma (seed, verificações pontuais)

Se um dia o app Next for removido, este diretório pode ir junto — desde que o
`prisma/seed.ts` seja portado antes, porque ele é quem popula o catálogo de
serviços e as categorias financeiras.
