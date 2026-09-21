-- Quais horarios estao livres, e como marcar um.
--
-- A conta de disponibilidade mora aqui, e nao no navegador, por duas razoes.
--
-- Primeira: o visitante nao pode ler a tabela de agendamentos — ela tem nome e
-- telefone de todo mundo que marcou. Calcular no cliente exigiria entregar a
-- agenda inteira para quem so quer saber se as 14h esta livre.
--
-- Segunda: dois visitantes olhando a mesma tela veem os mesmos horarios livres.
-- Se a decisao final fosse do navegador, os dois marcariam as 14h. A gravacao
-- confere a capacidade de novo, dentro da transacao, e o segundo perde.

-- ------------------------------------------------------------
-- Horarios livres de um servico num dia
-- ------------------------------------------------------------
create or replace function public.horarios_disponiveis(
  p_servico_id text,
  p_data       date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_servico   public.servicos%rowtype;
  v_cap       public.capacidade_setor%rowtype;
  v_exp       public.horarios_funcionamento%rowtype;
  v_setor     public."Setor";
  v_duracao   interval;
  v_res       jsonb;
begin
  select * into v_servico from public.servicos where id = p_servico_id and ativo;
  if not found then
    return jsonb_build_object('erro', 'servico nao encontrado', 'horarios', '[]'::jsonb);
  end if;

  v_setor := public.setor_do_servico(v_servico.categoria);

  select * into v_cap from public.capacidade_setor where setor = v_setor;
  if not found or v_cap.simultaneos <= 0 or not v_cap."aceitaSite" then
    return jsonb_build_object(
      'erro', 'este servico e agendado por avaliacao presencial',
      'horarios', '[]'::jsonb);
  end if;

  select * into v_exp from public.horarios_funcionamento
  where "diaSemana" = extract(dow from p_data)::int;

  if not found or not v_exp.aberto then
    return jsonb_build_object('erro', 'fechado neste dia', 'horarios', '[]'::jsonb);
  end if;

  -- Sem duracao cadastrada o servico nao entra na agenda: chutar uma hora daria
  -- horario errado e carro parado.
  if coalesce(v_servico."duracaoMin", 0) <= 0 then
    return jsonb_build_object(
      'erro', 'servico sem duracao definida', 'horarios', '[]'::jsonb);
  end if;
  v_duracao := make_interval(mins => v_servico."duracaoMin");

  with grade as (
    -- Passos de 30 minutos. Granularidade menor enche a tela de opcoes que
    -- ninguem usa; maior deixa buraco util sem aproveitamento.
    select generate_series(
      (p_data + v_exp.abre)::timestamptz,
      (p_data + v_exp.fecha)::timestamptz - v_duracao,
      interval '30 minutes'
    ) inicio
  ),
  candidatos as (
    select g.inicio, g.inicio + v_duracao fim
    from grade g
    where
      -- Nao comeca no passado, e exige uma hora de antecedencia: agendamento
      -- para daqui a cinco minutos nao chega a tempo de ninguem ver.
      g.inicio > now() + interval '1 hour'
      -- Nao atravessa o intervalo de almoco.
      and (
        v_exp."pausaInicio" is null or v_exp."pausaFim" is null
        or g.inicio + v_duracao <= (p_data + v_exp."pausaInicio")::timestamptz
        or g.inicio >= (p_data + v_exp."pausaFim")::timestamptz
      )
      -- Nao cai em feriado ou fechamento.
      and not exists (
        select 1 from public.bloqueios_agenda b
        where b.inicio < g.inicio + v_duracao and b.fim > g.inicio
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'inicio', c.inicio,
    'fim', c.fim,
    'hora', to_char(c.inicio, 'HH24:MI'),
    'vagas', v_cap.simultaneos - coalesce(o.ocupados, 0)
  ) order by c.inicio), '[]'::jsonb)
  into v_res
  from candidatos c
  left join lateral (
    -- Conta quem ja ocupa o setor em qualquer instante que cruze este horario.
    -- Cancelado e falta nao ocupam vaga.
    select count(*) ocupados
    from public.agendamentos a
    where a.setor = v_setor
      and a.status in ('PENDENTE','CONFIRMADO','COMPARECEU')
      and a.inicio < c.fim and a.fim > c.inicio
  ) o on true
  where v_cap.simultaneos - coalesce(o.ocupados, 0) > 0;

  return jsonb_build_object(
    'servico', v_servico.nome,
    'duracaoMin', v_servico."duracaoMin",
    'preco', v_servico.preco,
    'setor', v_setor,
    'horarios', v_res
  );
end;
$$;

-- ------------------------------------------------------------
-- De que setor e cada categoria de servico
-- ------------------------------------------------------------
create or replace function public.setor_do_servico(p_categoria public."CategoriaServico")
returns public."Setor"
language sql
immutable
as $$
  select case p_categoria
    when 'LAVAGEM'       then 'LAVAGEM'
    when 'ESTETICA'      then 'ESTETICA'
    when 'REVITALIZACAO' then 'ESTETICA'
    when 'VITRIFICACAO'  then 'ESTETICA'
    when 'PELICULA'      then 'PELICULA'
    when 'FUNILARIA'     then 'FUNILARIA'
    when 'PINTURA'       then 'PINTURA'
    when 'MECANICA'      then 'MECANICA'
    else 'LAVAGEM'
  end::public."Setor";
$$;

-- ------------------------------------------------------------
-- Marcar pelo site
-- ------------------------------------------------------------
create or replace function public.agendar_publico(
  p_servico_id  text,
  p_inicio      timestamptz,
  p_nome        text,
  p_telefone    text,
  p_placa       text default null,
  p_veiculo     text default null,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_servico  public.servicos%rowtype;
  v_cap      public.capacidade_setor%rowtype;
  v_exp      public.horarios_funcionamento%rowtype;
  v_setor    public."Setor";
  v_fim      timestamptz;
  v_ocupados int;
  v_recentes int;
  v_id       text := gen_random_uuid()::text;
  v_numero   int;
  v_tel      text;
begin
  -- --- validacao do que veio da rua ---
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'informe seu nome' using errcode = 'P0001';
  end if;

  v_tel := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if length(v_tel) < 10 or length(v_tel) > 11 then
    raise exception 'informe um telefone valido com DDD' using errcode = 'P0001';
  end if;

  select * into v_servico from public.servicos where id = p_servico_id and ativo;
  if not found then
    raise exception 'servico indisponivel' using errcode = 'P0002';
  end if;
  if coalesce(v_servico."duracaoMin", 0) <= 0 then
    raise exception 'este servico nao e agendavel pelo site' using errcode = 'P0001';
  end if;

  v_setor := public.setor_do_servico(v_servico.categoria);
  v_fim := p_inicio + make_interval(mins => v_servico."duracaoMin");

  -- Limite por telefone: sem isso um script marcaria a agenda inteira em
  -- segundos. Tres por dia cobre a familia que traz dois carros e barra abuso.
  select count(*) into v_recentes
  from public.agendamentos
  where telefone = v_tel
    and "criadoEm" > now() - interval '24 hours'
    and status <> 'CANCELADO';
  if v_recentes >= 3 then
    raise exception 'ja ha agendamentos demais para este telefone hoje; fale conosco pelo WhatsApp'
      using errcode = 'P0001';
  end if;

  if p_inicio <= now() + interval '1 hour' then
    raise exception 'escolha um horario com pelo menos uma hora de antecedencia'
      using errcode = 'P0001';
  end if;

  select * into v_exp from public.horarios_funcionamento
  where "diaSemana" = extract(dow from p_inicio)::int;
  if not found or not v_exp.aberto then
    raise exception 'estamos fechados neste dia' using errcode = 'P0001';
  end if;
  if p_inicio::time < v_exp.abre or v_fim::time > v_exp.fecha then
    raise exception 'horario fora do periodo de funcionamento' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.bloqueios_agenda b
             where b.inicio < v_fim and b.fim > p_inicio) then
    raise exception 'esta data esta bloqueada na agenda' using errcode = 'P0001';
  end if;

  select * into v_cap from public.capacidade_setor where setor = v_setor;
  if not found or not v_cap."aceitaSite" or v_cap.simultaneos <= 0 then
    raise exception 'este servico e agendado por avaliacao presencial'
      using errcode = 'P0001';
  end if;

  -- --- a conferencia que decide a corrida ---
  -- Dois visitantes veem o mesmo horario livre na tela. O `for update` na
  -- capacidade serializa a gravacao: o segundo espera o primeiro terminar e
  -- entao encontra a vaga ja tomada.
  perform 1 from public.capacidade_setor where setor = v_setor for update;

  select count(*) into v_ocupados
  from public.agendamentos a
  where a.setor = v_setor
    and a.status in ('PENDENTE','CONFIRMADO','COMPARECEU')
    and a.inicio < v_fim and a.fim > p_inicio;

  if v_ocupados >= v_cap.simultaneos then
    raise exception 'este horario acabou de ser preenchido; escolha outro'
      using errcode = 'P0001';
  end if;

  insert into public.agendamentos
    (id, status, origem, "servicoId", inicio, fim, setor,
     nome, telefone, placa, "veiculoDesc", observacoes)
  values
    (v_id, 'PENDENTE', 'SITE', p_servico_id, p_inicio, v_fim, v_setor,
     btrim(p_nome), v_tel,
     nullif(upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g')), ''),
     nullif(btrim(coalesce(p_veiculo, '')), ''),
     nullif(btrim(coalesce(p_observacoes, '')), ''))
  returning numero into v_numero;

  -- Alerta para alguem confirmar. O agendamento nasce pendente de proposito; se
  -- ninguem for avisado, ele fica pendente para sempre.
  insert into public.alertas
    (id, tipo, status, titulo, descricao, "dataAlvo", "criadoEm")
  values
    (gen_random_uuid()::text, 'POS_VENDA', 'PENDENTE',
     'Confirmar agendamento #' || v_numero || ' — ' || btrim(p_nome),
     v_servico.nome || ' em ' || to_char(p_inicio, 'DD/MM')
       || ' as ' || to_char(p_inicio, 'HH24:MI')
       || '. Telefone ' || v_tel || '.',
     now(), now());

  return jsonb_build_object(
    'numero', v_numero,
    'servico', v_servico.nome,
    'inicio', p_inicio,
    'fim', v_fim,
    'status', 'PENDENTE'
  );
end;
$$;

-- ------------------------------------------------------------
-- Servicos que o site pode agendar
-- ------------------------------------------------------------
create or replace function public.servicos_agendaveis()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'nome', s.nome,
    'categoria', s.categoria,
    'preco', s.preco,
    'duracaoMin', s."duracaoMin",
    'descricao', s.descricao,
    'garantiaDias', s."garantiaDias"
  ) order by s.categoria, s.preco), '[]'::jsonb)
  from public.servicos s
  join public.capacidade_setor c
    on c.setor = public.setor_do_servico(s.categoria)
  where s.ativo
    and coalesce(s."duracaoMin", 0) > 0
    and c."aceitaSite"
    and c.simultaneos > 0;
$$;

revoke all on function public.horarios_disponiveis(text, date) from public;
revoke all on function public.agendar_publico(text, timestamptz, text, text, text, text, text) from public;
revoke all on function public.servicos_agendaveis() from public;

grant execute on function public.horarios_disponiveis(text, date) to anon, authenticated;
grant execute on function public.agendar_publico(text, timestamptz, text, text, text, text, text) to anon, authenticated;
grant execute on function public.servicos_agendaveis() to anon, authenticated;
