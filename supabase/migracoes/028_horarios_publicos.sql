-- Horario de funcionamento na pagina publica.
--
-- Ate agora o site nao dizia quando a oficina abre — a informacao existia so na
-- cabeca de quem atende. Com a agenda cadastrada, isso virou dado, e dado que
-- ja existe nao deve ser digitado de novo num texto que ninguem lembra de
-- atualizar quando o horario muda.
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
    'instagram', e.instagram,
    'horarios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'diaSemana', h."diaSemana",
        'aberto', h.aberto,
        'abre', to_char(h.abre, 'HH24:MI'),
        'fecha', to_char(h.fecha, 'HH24:MI'),
        'pausaInicio', to_char(h."pausaInicio", 'HH24:MI'),
        'pausaFim', to_char(h."pausaFim", 'HH24:MI')
      ) order by h."diaSemana"), '[]'::jsonb)
      from public.horarios_funcionamento h
    )
    -- CNPJ segue de fora: nao acrescenta nada ao visitante.
  )
  from public.empresa e where e.id = 'default';
$$;

revoke all on function public.empresa_publica from public;
grant execute on function public.empresa_publica to anon, authenticated;
