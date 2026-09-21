-- Catalogo publico para a landing page.
--
-- O visitante do site nao esta logado: e o papel `anon`, que a migracao 002
-- deixou sem acesso a nada. Esta e a excecao, e por isso ela e estreita.
--
-- NAO liberei a tabela `servicos` para o anon. Ela tem `comissaoPct`, que e a
-- margem paga ao funcionario — informacao interna que nao pode sair no HTML de
-- uma pagina publica. A funcao devolve so o que um cliente veria numa placa de
-- preco na parede: nome, categoria, preco, prazo e garantia.
--
-- `security definer` para conseguir ler a tabela apesar da RLS, com o conjunto
-- de colunas fixado aqui dentro — nao ha parametro que amplie o que sai.

create or replace function public.catalogo_publico()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(x order by x.ordem, x.preco), '[]'::jsonb)
  from (
    select
      s.nome,
      s.categoria::text                as categoria,
      s.preco,
      s.descricao,
      s."garantiaDias",
      s."duracaoMin",
      -- Ordem de exibicao pensada para o site, nao alfabetica: a lavagem e a
      -- porta de entrada e precisa vir primeiro; funilaria e pintura, que sao
      -- os tickets altos, fecham a lista.
      case s.categoria::text
        when 'LAVAGEM'       then 1
        when 'ESTETICA'      then 2
        when 'REVITALIZACAO' then 3
        when 'VITRIFICACAO'  then 4
        when 'PELICULA'      then 5
        when 'FUNILARIA'     then 6
        when 'PINTURA'       then 7
        else 8
      end as ordem
    from public.servicos s
    where s.ativo
  ) x;
$$;

comment on function public.catalogo_publico is
  'Catalogo para a landing page. Exposto ao anon de proposito, com colunas '
  'fixas: nunca inclui comissaoPct nem custo.';

-- ------------------------------------------------------------
-- Dados de contato da empresa, tambem para a pagina publica
-- ------------------------------------------------------------
create or replace function public.empresa_publica()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'nome', e.nome,
    'telefone', coalesce(e.whatsapp, e.telefone),
    'whatsapp', e.whatsapp,
    'email', e.email,
    'endereco', e.endereco,
    'cidade', e.cidade,
    'uf', e.uf,
    'cep', e.cep,
    'instagram', e.instagram
    -- CNPJ fica de fora: nao acrescenta nada ao visitante e e dado da empresa
    -- que nao precisa estar num HTML publico.
  )
  from public.empresa e where e.id = 'default';
$$;

revoke all on function public.catalogo_publico from public;
revoke all on function public.empresa_publica  from public;
grant execute on function public.catalogo_publico to anon, authenticated;
grant execute on function public.empresa_publica  to anon, authenticated;
