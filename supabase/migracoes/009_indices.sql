-- Indices nas chaves estrangeiras que nao tinham.
--
-- O Postgres cria indice sozinho para chave primaria e para restricao unique,
-- mas NAO para chave estrangeira. Enquanto as tabelas tinham dezenas de linhas
-- isso nao aparecia; com um ano de operacao (2.150 ordens, 6.888 vistorias) as
-- telas que cruzam tabelas passaram a varrer tudo.
--
-- Medido antes: a lista de vistorias levava 4 segundos para abrir, e o join
-- aninhado sozinho respondia por ~900ms.
--
-- Vale tambem para o DELETE: apagar um cliente obriga o banco a conferir cada
-- tabela que o referencia, e sem indice essa conferencia e uma varredura.

create index if not exists alertas_cliente_idx      on public.alertas ("clienteId");
create index if not exists alertas_ordem_idx        on public.alertas ("ordemId");
create index if not exists alertas_veiculo_idx      on public.alertas ("veiculoId");

create index if not exists comissoes_ordem_idx      on public.comissoes ("ordemId");

create index if not exists cot_forn_fornecedor_idx  on public.cotacao_fornecedores ("fornecedorId");
create index if not exists cotacoes_solicitante_idx on public.cotacoes ("solicitanteId");

create index if not exists lancamentos_categoria_idx on public.lancamentos ("categoriaId");
create index if not exists lancamentos_ordem_idx     on public.lancamentos ("ordemId");

create index if not exists orc_itens_servico_idx    on public.orcamento_itens ("servicoId");
create index if not exists orcamentos_veiculo_idx   on public.orcamentos ("veiculoId");
create index if not exists orcamentos_vendedor_idx  on public.orcamentos ("vendedorId");

create index if not exists os_func_entrada_idx      on public.ordens_servico ("funcionarioEntradaId");
create index if not exists os_func_saida_idx        on public.ordens_servico ("funcionarioSaidaId");
create index if not exists os_veiculo_idx           on public.ordens_servico ("veiculoId");

create index if not exists os_itens_responsavel_idx on public.os_itens ("responsavelId");
create index if not exists os_itens_servico_idx     on public.os_itens ("servicoId");

create index if not exists perfis_funcionario_idx   on public.perfis (funcionario_id);

create index if not exists vistorias_funcionario_idx on public.vistorias ("funcionarioId");
create index if not exists vistorias_refeita_idx     on public.vistorias ("refeitaDe");

-- As listas ordenam por estas colunas e so mostram as primeiras 100. Sem o
-- indice o banco ordena a tabela inteira para descartar quase tudo.
create index if not exists vistorias_data_idx       on public.vistorias (data desc);
create index if not exists orcamentos_criado_idx    on public.orcamentos ("criadoEm" desc);
create index if not exists os_numero_idx            on public.ordens_servico (numero desc);
create index if not exists lancamentos_venc_idx     on public.lancamentos (vencimento desc);

analyze public.vistorias;
analyze public.orcamentos;
analyze public.ordens_servico;
analyze public.alertas;
analyze public.lancamentos;
analyze public.comissoes;
