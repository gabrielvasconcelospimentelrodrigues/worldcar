-- Foto do modelo do veiculo.
--
-- Contexto da decisao: a FIPE nao tem imagem (devolve 9 campos, todos texto) e
-- nenhuma base publica liga placa a foto do carro individual. O que da para
-- fazer e buscar uma foto do MODELO na Wikipedia/Wikimedia a partir da marca e
-- do modelo que o cadastro ja coleta. E foto do modelo, nao daquele carro:
-- quem mostra o carro de verdade e a vistoria de entrada.
--
-- As imagens do Wikimedia sao licenciadas (CC BY-SA na maioria), entao autor e
-- licenca vem junto e sao exibidos. Sem credito seria uso indevido.

-- Cache por modelo, compartilhado: o segundo Corolla reaproveita a busca do
-- primeiro. A Wikipedia limita requisicoes por origem (429), e sem isto cada
-- cadastro bateria na API de novo pelo mesmo carro.
-- Renomeia se a versao anterior desta migracao criou as colunas sem aspas
-- (o Postgres dobra para minusculo, destoando do camelCase do resto do banco).
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'modelo_fotos' and column_name = 'licencaurl') then
    alter table public.modelo_fotos rename column licencaurl to "licencaUrl";
    alter table public.modelo_fotos rename column paginaurl  to "paginaUrl";
  end if;
end $$;

create table if not exists public.modelo_fotos (
  chave        text primary key,          -- 'toyota|corolla', normalizado
  marca        text not null,
  modelo       text not null,
  url          text,                      -- null = procuramos e nao achamos
  autor        text,
  licenca      text,
  "licencaUrl" text,
  "paginaUrl"  text,
  "criadoEm"   timestamptz not null default now()
);

comment on table public.modelo_fotos is
  'Cache de fotos de modelo vindas do Wikimedia. url nulo = busca sem resultado, para nao repetir.';

alter table public.veiculos
  add column if not exists "fotoUrl"     text,
  add column if not exists "fotoCredito" text,
  add column if not exists "fotoOrigem"  text
    check ("fotoOrigem" is null or "fotoOrigem" in ('WEB','VISTORIA','MANUAL'));

comment on column public.veiculos."fotoOrigem" is
  'WEB = foto generica do modelo; VISTORIA = foto real do carro; MANUAL = enviada a mao.';

-- RLS: e cache publico de dados publicos, sem nada sensivel. Toda a equipe le e
-- escreve; o anon continua sem acesso, como nas demais tabelas.
alter table public.modelo_fotos enable row level security;
revoke all on public.modelo_fotos from anon;

drop policy if exists modelo_fotos_ler on public.modelo_fotos;
create policy modelo_fotos_ler on public.modelo_fotos
  for select to authenticated using (public.eh_equipe());

drop policy if exists modelo_fotos_escrever on public.modelo_fotos;
create policy modelo_fotos_escrever on public.modelo_fotos
  for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
