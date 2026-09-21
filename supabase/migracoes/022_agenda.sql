-- Agenda e agendamento pelo site.
--
-- O que limita quantos carros entram ao mesmo tempo nao e o relogio, e a
-- EQUIPE: dois lavadores lavam dois carros, nao dez. Por isso a capacidade e
-- por setor, e cada servico consome a capacidade do setor que o executa.
-- Agenda que so olha horario aceita seis polimentos as 9h para um esteticista
-- so — e alguem descobre isso com os carros no patio.
--
-- Nenhum horario fica fixo no codigo: funcionamento, capacidade e feriados sao
-- cadastro. Oficina muda horario no verao, fecha em feriado municipal que
-- nenhum calendario embutido conhece, e contrata mais gente.

-- ------------------------------------------------------------
-- Funcionamento por dia da semana
-- ------------------------------------------------------------
create table if not exists public.horarios_funcionamento (
  -- 0 = domingo, seguindo `extract(dow)` do Postgres, para nao precisar
  -- converter nada na hora de consultar.
  "diaSemana"   int primary key check ("diaSemana" between 0 and 6),
  aberto        boolean not null default true,
  abre          time not null default '08:00',
  fecha         time not null default '18:00',
  -- Intervalo de almoco: nulo significa que nao fecha.
  "pausaInicio" time,
  "pausaFim"    time,
  check ("pausaInicio" is null or "pausaFim" is null or "pausaFim" > "pausaInicio"),
  check (fecha > abre)
);

insert into public.horarios_funcionamento ("diaSemana", aberto, abre, fecha, "pausaInicio", "pausaFim")
values
  (0, false, '08:00', '18:00', null, null),          -- domingo
  (1, true,  '08:00', '18:00', '12:00', '13:00'),
  (2, true,  '08:00', '18:00', '12:00', '13:00'),
  (3, true,  '08:00', '18:00', '12:00', '13:00'),
  (4, true,  '08:00', '18:00', '12:00', '13:00'),
  (5, true,  '08:00', '18:00', '12:00', '13:00'),
  (6, true,  '08:00', '12:00', null, null)           -- sabado ate meio-dia
on conflict ("diaSemana") do nothing;

-- ------------------------------------------------------------
-- Quantos carros por setor ao mesmo tempo
-- ------------------------------------------------------------
create table if not exists public.capacidade_setor (
  setor       public."Setor" primary key,
  simultaneos int not null default 1 check (simultaneos >= 0),
  -- Desligar aceita agendamento pelo site para aquele setor. Funilaria costuma
  -- exigir olhar o carro antes de dar prazo.
  "aceitaSite" boolean not null default true
);

insert into public.capacidade_setor (setor, simultaneos, "aceitaSite")
select s.setor,
       greatest(1, count(*) filter (where f.ativo)),
       -- Funilaria e pintura dependem de avaliacao presencial: o site nao tem
       -- como saber o tamanho do reparo, e um horario errado trava a oficina.
       s.setor not in ('FUNILARIA', 'PINTURA')
from (select unnest(enum_range(null::public."Setor")) setor) s
left join public.funcionarios f on f.setor = s.setor
group by s.setor
on conflict (setor) do nothing;

-- ------------------------------------------------------------
-- Feriados e fechamentos
-- ------------------------------------------------------------
create table if not exists public.bloqueios_agenda (
  id         text primary key,
  inicio     timestamptz not null,
  fim        timestamptz not null,
  motivo     text not null,
  "criadoEm" timestamptz not null default now(),
  check (fim > inicio)
);

create index if not exists bloqueios_periodo_idx on public.bloqueios_agenda (inicio, fim);

-- ------------------------------------------------------------
-- Agendamentos
-- ------------------------------------------------------------
create sequence if not exists public.agendamentos_numero_seq;

create table if not exists public.agendamentos (
  id             text primary key,
  numero         int not null unique default nextval('public.agendamentos_numero_seq'),
  status         text not null default 'PENDENTE'
                   check (status in ('PENDENTE','CONFIRMADO','CANCELADO','COMPARECEU','FALTOU')),
  origem         text not null default 'SITE' check (origem in ('SITE','INTERNO')),

  "servicoId"    text not null references public.servicos (id) on delete restrict,
  inicio         timestamptz not null,
  fim            timestamptz not null,
  setor          public."Setor" not null,

  -- Quem agendou pelo site ainda nao e cadastro: digita nome, telefone e placa.
  -- O vinculo com `clientes` acontece quando a loja confirma e reconhece a
  -- pessoa — forcar cadastro completo antes de agendar derruba a conversao.
  "clienteId"    text references public.clientes (id) on delete set null,
  "veiculoId"    text references public.veiculos (id) on delete set null,
  nome           text not null,
  telefone       text not null,
  placa          text,
  "veiculoDesc"  text,
  observacoes    text,

  "ordemId"      text references public.ordens_servico (id) on delete set null,
  "confirmadoEm" timestamptz,
  "canceladoEm"  timestamptz,
  "motivoCancelamento" text,

  "criadoEm"     timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now(),
  check (fim > inicio)
);

create index if not exists agendamentos_inicio_idx  on public.agendamentos (inicio);
create index if not exists agendamentos_status_idx  on public.agendamentos (status);
create index if not exists agendamentos_setor_idx   on public.agendamentos (setor, inicio);
create index if not exists agendamentos_telefone_idx on public.agendamentos (telefone);
create index if not exists agendamentos_cliente_idx on public.agendamentos ("clienteId");

comment on table public.agendamentos is
  'Horarios marcados. Nasce PENDENTE quando vem do site: alguem da loja confirma '
  'antes de o horario valer, o que barra trote e caso que exige avaliacao.';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.horarios_funcionamento enable row level security;
alter table public.capacidade_setor       enable row level security;
alter table public.bloqueios_agenda       enable row level security;
alter table public.agendamentos           enable row level security;

revoke all on public.horarios_funcionamento from anon;
revoke all on public.capacidade_setor       from anon;
revoke all on public.bloqueios_agenda       from anon;
-- O visitante NAO le nem escreve a tabela de agendamentos: ela guarda nome e
-- telefone de todo mundo que marcou. Ele so chega ali pelas funcoes adiante,
-- que devolvem horario livre sem revelar de quem e o horario ocupado.
revoke all on public.agendamentos from anon;

drop policy if exists horarios_ler on public.horarios_funcionamento;
create policy horarios_ler on public.horarios_funcionamento
  for select to authenticated using (public.eh_equipe());
drop policy if exists horarios_escrever on public.horarios_funcionamento;
create policy horarios_escrever on public.horarios_funcionamento
  for all to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

drop policy if exists capacidade_ler on public.capacidade_setor;
create policy capacidade_ler on public.capacidade_setor
  for select to authenticated using (public.eh_equipe());
drop policy if exists capacidade_escrever on public.capacidade_setor;
create policy capacidade_escrever on public.capacidade_setor
  for all to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

drop policy if exists bloqueios_ler on public.bloqueios_agenda;
create policy bloqueios_ler on public.bloqueios_agenda
  for select to authenticated using (public.eh_equipe());
drop policy if exists bloqueios_escrever on public.bloqueios_agenda;
create policy bloqueios_escrever on public.bloqueios_agenda
  for all to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

drop policy if exists agendamentos_ler on public.agendamentos;
create policy agendamentos_ler on public.agendamentos
  for select to authenticated using (public.eh_equipe());
drop policy if exists agendamentos_escrever on public.agendamentos;
create policy agendamentos_escrever on public.agendamentos
  for all to authenticated using (public.eh_atendimento()) with check (public.eh_atendimento());
