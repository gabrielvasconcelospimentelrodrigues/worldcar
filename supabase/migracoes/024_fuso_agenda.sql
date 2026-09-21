-- Corrige o fuso horario da agenda.
--
-- O banco roda em UTC. `(data + time '08:00')::timestamptz` produz 08:00 UTC,
-- que no Brasil e 05:00 da manha — a agenda oferecia horarios que a oficina nao
-- abre, e gravava a marcacao tres horas antes do combinado.
--
-- O mesmo erro afetava tres checagens que nao sao obvias:
--
--   `extract(dow from inicio)`   sabado as 23h e DOMINGO em UTC, entao o
--                                sistema consultaria o horario do dia errado.
--   `inicio::time < abre`        compara 02:00 UTC com 08:00 local e recusa um
--                                horario valido.
--   `fim::time > fecha`          o mesmo, do outro lado.
--
-- A correcao e interpretar sempre no fuso da oficina, com `at time zone`. O
-- fuso vem de uma funcao, e nao repetido em cada consulta: quando a oficina
-- abrir filial em outro estado, muda num lugar so.

create or replace function public.fuso_empresa()
returns text
language sql
immutable
as $$ select 'America/Sao_Paulo'::text $$;

comment on function public.fuso_empresa is
  'Fuso da oficina. O banco roda em UTC; toda conta de agenda converte por aqui.';

-- ------------------------------------------------------------
-- Horarios livres, agora no fuso certo
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
  v_servico public.servicos%rowtype;
  v_cap     public.capacidade_setor%rowtype;
  v_exp     public.horarios_funcionamento%rowtype;
  v_setor   public."Setor";
  v_duracao interval;
  v_fuso    text := public.fuso_empresa();
  v_abre    timestamptz;
  v_fecha   timestamptz;
  v_pausa_i timestamptz;
  v_pausa_f timestamptz;
  v_res     jsonb;
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

  if coalesce(v_servico."duracaoMin", 0) <= 0 then
    return jsonb_build_object(
      'erro', 'servico sem duracao definida', 'horarios', '[]'::jsonb);
  end if;
  v_duracao := make_interval(mins => v_servico."duracaoMin");

  -- `at time zone` le o horario ingenuo COMO local da oficina e devolve o
  -- instante correto. E a diferenca entre "08:00 aqui" e "08:00 em Londres".
  v_abre  := (p_data + v_exp.abre)  at time zone v_fuso;
  v_fecha := (p_data + v_exp.fecha) at time zone v_fuso;
  v_pausa_i := case when v_exp."pausaInicio" is null then null
                 else (p_data + v_exp."pausaInicio") at time zone v_fuso end;
  v_pausa_f := case when v_exp."pausaFim" is null then null
                 else (p_data + v_exp."pausaFim") at time zone v_fuso end;

  with grade as (
    select generate_series(v_abre, v_fecha - v_duracao, interval '30 minutes') inicio
  ),
  candidatos as (
    select g.inicio, g.inicio + v_duracao fim
    from grade g
    where g.inicio > now() + interval '1 hour'
      and (
        v_pausa_i is null or v_pausa_f is null
        or g.inicio + v_duracao <= v_pausa_i
        or g.inicio >= v_pausa_f
      )
      and not exists (
        select 1 from public.bloqueios_agenda b
        where b.inicio < g.inicio + v_duracao and b.fim > g.inicio
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'inicio', c.inicio,
    'fim', c.fim,
    -- A hora exibida tambem sai no fuso da oficina; sem isso a tela mostraria
    -- 11:00 para um horario que a loja chama de 08:00.
    'hora', to_char(c.inicio at time zone v_fuso, 'HH24:MI'),
    'vagas', v_cap.simultaneos - coalesce(o.ocupados, 0)
  ) order by c.inicio), '[]'::jsonb)
  into v_res
  from candidatos c
  left join lateral (
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
    'fuso', v_fuso,
    'horarios', v_res
  );
end;
$$;

-- ------------------------------------------------------------
-- Marcacao, com as mesmas conversoes
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
  v_servico   public.servicos%rowtype;
  v_cap       public.capacidade_setor%rowtype;
  v_exp       public.horarios_funcionamento%rowtype;
  v_setor     public."Setor";
  v_fim       timestamptz;
  v_ocupados  int;
  v_recentes  int;
  v_id        text := gen_random_uuid()::text;
  v_numero    int;
  v_tel       text;
  v_fuso      text := public.fuso_empresa();
  v_local     timestamp;
  v_local_fim timestamp;
begin
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

  -- O relogio de parede da oficina, para comparar com o horario cadastrado.
  v_local     := p_inicio at time zone v_fuso;
  v_local_fim := v_fim    at time zone v_fuso;

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

  -- Dia da semana pelo calendario da oficina: sabado as 23h e domingo em UTC.
  select * into v_exp from public.horarios_funcionamento
  where "diaSemana" = extract(dow from v_local)::int;
  if not found or not v_exp.aberto then
    raise exception 'estamos fechados neste dia' using errcode = 'P0001';
  end if;

  if v_local::time < v_exp.abre or v_local_fim::time > v_exp.fecha then
    raise exception 'horario fora do periodo de funcionamento' using errcode = 'P0001';
  end if;

  if v_exp."pausaInicio" is not null and v_exp."pausaFim" is not null
     and v_local::time < v_exp."pausaFim" and v_local_fim::time > v_exp."pausaInicio" then
    raise exception 'este horario cai no intervalo de almoco' using errcode = 'P0001';
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

  insert into public.alertas
    (id, tipo, status, titulo, descricao, "dataAlvo", "criadoEm")
  values
    (gen_random_uuid()::text, 'POS_VENDA', 'PENDENTE',
     'Confirmar agendamento #' || v_numero || ' — ' || btrim(p_nome),
     v_servico.nome || ' em ' || to_char(v_local, 'DD/MM')
       || ' as ' || to_char(v_local, 'HH24:MI')
       || '. Telefone ' || v_tel || '.',
     now(), now());

  return jsonb_build_object(
    'numero', v_numero,
    'servico', v_servico.nome,
    'inicio', p_inicio,
    'fim', v_fim,
    'hora', to_char(v_local, 'HH24:MI'),
    'data', to_char(v_local, 'DD/MM/YYYY'),
    'status', 'PENDENTE'
  );
end;
$$;

revoke all on function public.fuso_empresa() from public;
grant execute on function public.fuso_empresa() to anon, authenticated;
