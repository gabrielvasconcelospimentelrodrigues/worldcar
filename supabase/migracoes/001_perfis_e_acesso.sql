-- ============================================================
-- World Car Service — 001: perfis e funcoes de acesso
--
-- Na arquitetura em que o navegador fala direto com o Supabase, quem decide
-- o que cada pessoa pode ver e fazer e o proprio banco. Este arquivo cria a
-- ponte entre o usuario autenticado (auth.users) e o funcionario, e as
-- funcoes de apoio que todas as politicas de RLS vao usar.
-- ============================================================

-- ------------------------------------------------------------
-- Perfil: liga o login ao funcionario e guarda o papel
-- ------------------------------------------------------------
create table if not exists public.perfis (
  id             uuid primary key references auth.users (id) on delete cascade,
  funcionario_id text references public."funcionarios" (id) on delete set null,
  papel          public."Papel" not null default 'TECNICO',
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

comment on table public.perfis is
  'Liga auth.users ao funcionario e define o papel usado pelas politicas de RLS.';

-- ------------------------------------------------------------
-- Funcoes de apoio
--
-- SECURITY DEFINER porque precisam ler `perfis` ignorando a propria RLS —
-- sem isso as politicas entrariam em recursao infinita.
-- STABLE permite ao Postgres reaproveitar o resultado dentro da mesma consulta,
-- em vez de reexecutar a cada linha avaliada.
-- `search_path` fixo evita sequestro da funcao por um schema malicioso.
-- ------------------------------------------------------------

create or replace function public.papel_atual()
returns public."Papel"
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p.papel
  from public.perfis p
  where p.id = auth.uid() and p.ativo
$$;

comment on function public.papel_atual() is
  'Papel do usuario autenticado, ou NULL se nao houver perfil ativo.';

create or replace function public.funcionario_atual()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p.funcionario_id
  from public.perfis p
  where p.id = auth.uid() and p.ativo
$$;

-- Atalhos legiveis, para as politicas nao virarem sopa de OR
create or replace function public.eh_admin()
returns boolean language sql stable
set search_path = public, pg_catalog
as $$ select public.papel_atual() = 'ADMIN' $$;

create or replace function public.eh_gestao()
returns boolean language sql stable
set search_path = public, pg_catalog
as $$ select public.papel_atual() in ('ADMIN','GERENTE') $$;

create or replace function public.eh_atendimento()
returns boolean language sql stable
set search_path = public, pg_catalog
as $$ select public.papel_atual() in ('ADMIN','GERENTE','ATENDENTE') $$;

create or replace function public.eh_equipe()
returns boolean language sql stable
set search_path = public, pg_catalog
as $$ select public.papel_atual() is not null $$;

-- ------------------------------------------------------------
-- Visao publica da equipe
--
-- Os seletores de "responsavel", "quem recebeu" e "quem entregou" precisam da
-- lista de funcionarios para qualquer pessoa logada. Mas dar SELECT na tabela
-- inteira exporia salario e CPF dos colegas ao tecnico — no sistema antigo isso
-- nao acontecia porque o servidor so mandava o necessario. Aqui a visao faz
-- esse recorte.
-- ------------------------------------------------------------
create or replace view public.equipe
with (security_invoker = true)
as
  select id, nome, cargo, setor, ativo
  from public."funcionarios";

comment on view public.equipe is
  'Funcionarios sem dados sensiveis (sem salario, CPF, endereco), para os seletores das telas.';

-- ------------------------------------------------------------
-- Perfil criado junto com o usuario do Auth
--
-- Sem isso, todo convite de funcionario exigiria dois passos manuais e um
-- usuario sem perfil ficaria logado porem sem enxergar nada.
-- ------------------------------------------------------------
create or replace function public.criar_perfil_do_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.perfis (id, papel, funcionario_id)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'papel')::public."Papel", 'TECNICO'),
    new.raw_user_meta_data ->> 'funcionario_id'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_do_novo_usuario();

-- ------------------------------------------------------------
-- RLS da propria tabela de perfis
-- ------------------------------------------------------------
alter table public.perfis enable row level security;

drop policy if exists perfis_leitura on public.perfis;
create policy perfis_leitura on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.eh_gestao());

drop policy if exists perfis_escrita_admin on public.perfis;
create policy perfis_escrita_admin on public.perfis
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- Ninguem alcanca `perfis` sem estar logado
revoke all on public.perfis from anon;
grant select on public.equipe to authenticated;
