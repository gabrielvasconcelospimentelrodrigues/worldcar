# World Car Service — aplicação

SPA em React + Vite que conversa direto com o Supabase, sem backend próprio.
Contém o site institucional (`/`) e o sistema de gestão (`/sistema`).

## Rodar

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a chave anon do projeto
npm run dev                  # http://localhost:3000
```

Acesso inicial: o usuario administrador e criado pelo seed. A senha vem de
`SEED_ADMIN_SENHA` no `.env.local` — **defina uma antes de rodar o seed e nunca
a escreva neste repositorio, que e publico**.

## Como a segurança funciona aqui

A chave `anon` viaja no pacote do navegador. Isso é esperado: ela é pública por
design. Quem protege os dados é o banco.

- **RLS em todas as tabelas.** Sem login não se lê nem escreve nada. Um técnico
  não alcança salário de colega, comissão alheia, financeiro nem orçamentos.
- **Salários fora do alcance.** A tabela `funcionarios` só abre para a gestão; as
  telas usam a visão `equipe`, que expõe apenas id, nome, cargo, setor e situação.
- **Dinheiro decidido no Postgres.** Comissão, faturamento e alertas são
  calculados por funções `SECURITY DEFINER` no banco. O navegador só pede
  "entregue a OS 42" — quanto isso gera não passa pelo cliente, então não dá para
  manipular pelo console do navegador.

As migrações ficam em [`../supabase/migracoes/`](../supabase/migracoes/) e são
aplicadas com `node ../supabase/aplicar.mjs`.

## Estrutura

```
src/
  telas/          uma tela por módulo (site, entrar, painel, orcamentos, ...)
  componentes/    ui.tsx (primitivas), logo, assinatura em canvas
  pdf/            os três documentos, com as três vias cada
  lib/
    supabase.ts       cliente e tradução dos erros do Postgres
    sessao.tsx        provedor de autenticação
    sessao-contexto.ts  contexto e hook (separados por causa do Fast Refresh)
    permissoes.ts     papéis e módulos — espelha a RLS
    consultas.ts      consultas reaproveitadas
    equipe.ts         cache da equipe (a RLS impede o join direto)
    fotos.ts          Storage: reduz no aparelho antes de subir
    tipos.ts          tipos do domínio
    format.ts         moeda, datas, placa, telefone, CPF/CNPJ
```

## Decisões que valem saber

**Fotos reduzidas no navegador.** Uma foto de celular chega com 4 MB. O canvas
reduz para 1600px antes do upload — a foto grande nem chega a subir pela rede da
oficina. Para o PDF, reduz de novo para 700px: sem isso um laudo com 30 fotos
passaria de 100 MB.

**PDF gerado no aparelho.** Sem rota de servidor. Depois da tela carregada, os
documentos saem mesmo com a internet instável. O `@react-pdf/renderer` pesa mais
de 1 MB, então é carregado sob demanda — só ao clicar no botão.

**Nomes de coluna em camelCase.** O schema foi criado pelo Prisma, então as
colunas são `"clienteId"`, `"criadoEm"` e não `cliente_id`. O PostgREST respeita
isso.

## Comandos

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run preview    # serve o build
npm run typecheck  # TypeScript
npm run lint       # oxlint
```
