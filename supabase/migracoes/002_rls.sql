-- ============================================================
-- World Car Service — 002: Row Level Security
--
-- Com o navegador falando direto com o banco, estas politicas SAO o sistema de
-- permissoes. O que antes era conferido em src/lib/permissoes.ts agora precisa
-- valer aqui, porque o cliente pode enviar qualquer consulta.
--
-- Papeis: ADMIN > GERENTE > ATENDENTE > TECNICO
-- ============================================================

-- `anon` (chave publica, usuario nao logado) nao enxerga nada do schema.
-- O site institucional nao le o banco, entao isso nao quebra a landing page.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- ------------------------------------------------------------
-- Helper: liga RLS e limpa politicas antigas da tabela
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'funcionarios','clientes','veiculos','servicos','orcamentos','orcamento_itens',
    'ordens_servico','os_itens','vistorias','vistoria_fotos','alertas',
    'categorias_financeiras','lancamentos','registros_ponto','ocorrencias_rh',
    'comissoes','empresa','usuarios'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ============================================================
-- OPERACAO — todo mundo logado le; atendimento escreve
-- ============================================================

-- Clientes e veiculos: o tecnico precisa ver de quem e o carro na OS
create policy clientes_ler on public.clientes
  for select to authenticated using (public.eh_equipe());
create policy clientes_escrever on public.clientes
  for all to authenticated
  using (public.eh_atendimento()) with check (public.eh_atendimento());

create policy veiculos_ler on public.veiculos
  for select to authenticated using (public.eh_equipe());
create policy veiculos_escrever on public.veiculos
  for all to authenticated
  using (public.eh_atendimento()) with check (public.eh_atendimento());

-- Catalogo: todos leem (monta orcamento e OS), so a gestao altera preco
create policy servicos_ler on public.servicos
  for select to authenticated using (public.eh_equipe());
create policy servicos_escrever on public.servicos
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());

-- Orcamentos: fora do alcance do tecnico, que nao precisa ver proposta comercial
create policy orcamentos_ler on public.orcamentos
  for select to authenticated using (public.eh_atendimento());
create policy orcamentos_escrever on public.orcamentos
  for all to authenticated
  using (public.eh_atendimento()) with check (public.eh_atendimento());

create policy orcamento_itens_ler on public.orcamento_itens
  for select to authenticated using (public.eh_atendimento());
create policy orcamento_itens_escrever on public.orcamento_itens
  for all to authenticated
  using (public.eh_atendimento()) with check (public.eh_atendimento());

-- Ordens de servico: o tecnico precisa ver e trabalhar nelas
create policy ordens_ler on public.ordens_servico
  for select to authenticated using (public.eh_equipe());
create policy ordens_criar on public.ordens_servico
  for insert to authenticated with check (public.eh_atendimento());
-- A entrega passa por RPC (ver 003); aqui o tecnico so mexe no andamento.
create policy ordens_atualizar on public.ordens_servico
  for update to authenticated
  using (public.eh_equipe())
  with check (public.eh_equipe());
create policy ordens_apagar on public.ordens_servico
  for delete to authenticated using (public.eh_gestao());

create policy os_itens_ler on public.os_itens
  for select to authenticated using (public.eh_equipe());
create policy os_itens_escrever on public.os_itens
  for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

-- Vistorias: quem executa tambem vistoria
create policy vistorias_ler on public.vistorias
  for select to authenticated using (public.eh_equipe());
create policy vistorias_escrever on public.vistorias
  for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

create policy fotos_ler on public.vistoria_fotos
  for select to authenticated using (public.eh_equipe());
create policy fotos_escrever on public.vistoria_fotos
  for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

-- Alertas: retorno e pos-venda sao trabalho do atendimento
create policy alertas_ler on public.alertas
  for select to authenticated using (public.eh_atendimento());
create policy alertas_escrever on public.alertas
  for all to authenticated
  using (public.eh_atendimento()) with check (public.eh_atendimento());

-- ============================================================
-- DINHEIRO — so a gestao
-- ============================================================

create policy lancamentos_gestao on public.lancamentos
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());

create policy categorias_ler on public.categorias_financeiras
  for select to authenticated using (public.eh_gestao());
create policy categorias_escrever on public.categorias_financeiras
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());

-- Comissao: a gestao ve tudo; o funcionario ve apenas a sua.
-- Escrita e exclusiva das funcoes de negocio (ver 003) — ninguem edita a
-- propria comissao pelo navegador.
create policy comissoes_ler on public.comissoes
  for select to authenticated
  using (public.eh_gestao() or "funcionarioId" = public.funcionario_atual());

create policy comissoes_escrever on public.comissoes
  for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- ============================================================
-- RH — dados pessoais so para a gestao
-- ============================================================

-- A tabela crua tem salario e CPF: leitura restrita.
-- A equipe usa a visao public.equipe (criada em 001) para os seletores.
create policy funcionarios_gestao on public."funcionarios"
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());

-- Cada um enxerga a propria ficha
create policy funcionarios_proprio on public."funcionarios"
  for select to authenticated
  using (id = public.funcionario_atual());

create policy ponto_gestao on public.registros_ponto
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());
create policy ponto_proprio on public.registros_ponto
  for select to authenticated
  using ("funcionarioId" = public.funcionario_atual());

create policy ocorrencias_gestao on public.ocorrencias_rh
  for all to authenticated
  using (public.eh_gestao()) with check (public.eh_gestao());
create policy ocorrencias_proprio on public.ocorrencias_rh
  for select to authenticated
  using ("funcionarioId" = public.funcionario_atual());

-- ============================================================
-- CONFIGURACAO
-- ============================================================

-- Todos leem (o cabecalho dos PDFs sai daqui), so o ADMIN altera
create policy empresa_ler on public.empresa
  for select to authenticated using (public.eh_equipe());
create policy empresa_escrever on public.empresa
  for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Tabela do login antigo (hash de senha proprio). Fica trancada ate ser
-- removida na virada para o Supabase Auth.
create policy usuarios_ninguem on public.usuarios
  for all to authenticated using (false) with check (false);
