/**
 * Recusa os comandos do Prisma que sincronizariam o banco com o schema.prisma.
 * O schema esta defasado: nao conhece `perfis` (autenticacao) nem as tabelas de
 * compras, nem as politicas de RLS. Rodar db:push apagaria tudo isso.
 */
console.error(`
  Comando desativado de proposito.

  A estrutura do banco agora vem de supabase/migracoes/*.sql, nao do
  schema.prisma — que desconhece 6 tabelas (incluindo 'perfis', de que a
  autenticacao depende), 38 politicas de RLS e 14 funcoes.

  Rodar isto apagaria tudo isso.

  Para aplicar mudancas de estrutura:
      node supabase/aplicar.mjs

  Detalhes em prisma/AVISO.md
`);
process.exit(1);
