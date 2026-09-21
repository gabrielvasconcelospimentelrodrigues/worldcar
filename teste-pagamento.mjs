/**
 * Exercita a logica de pagamento do agendamento sem depender do Mercado Pago.
 *
 * O que a funcao de borda faz e traduzir o formato do provedor e chamar
 * `registrar_desfecho_pagamento`. Chamando essa funcao direto, testamos a parte
 * que decide — confirmar, cancelar, nao duplicar — sem precisar de conta,
 * cartao de teste ou tunel para receber webhook.
 */
for (const f of [".env", ".env.local"]) {
  try { process.loadEnvFile(f); } catch { /* ausente */ }
}
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const q = (s, p) => c.query(s, p).then((r) => r.rows);

const [sv] = await q(
  `select id, nome, preco, categoria from public.servicos
   where ativo and "duracaoMin" > 0 limit 1`);

let n = 0;
async function criar(nome, horas, reservadoAte = null) {
  const [r] = await q(
    `insert into public.agendamentos
       (id, status, origem, "servicoId", inicio, fim, setor, nome, telefone, "reservadoAte")
     values (gen_random_uuid()::text, 'PENDENTE', 'SITE', $1,
             $2::timestamptz, $2::timestamptz + interval '40 min',
             public.setor_do_servico($3::public."CategoriaServico"), $4, $5,
             $6::timestamptz)
     returning id, numero, status`,
    [sv.id, new Date(Date.now() + horas * 3600_000).toISOString(), sv.categoria,
      nome, `4199999${String(++n).padStart(3, "0")}`, reservadoAte]);
  return r;
}

const ag = await criar("Teste Pagamento", 26);
console.log(`agendamento #${ag.numero} criado como ${ag.status}`);

const pagId = crypto.randomUUID();
const sinal = (Number(sv.preco) * 0.3).toFixed(2);
await q(
  `insert into public.pagamentos_online
     (id, "agendamentoId", provedor, status, valor, "expiraEm")
   values ($1, $2, 'MERCADO_PAGO', 'PENDENTE', $3::numeric, now() + interval '30 min')`,
  [pagId, ag.id, sinal]);
await q(
  `update public.agendamentos
   set "pagamentoId" = $1, "reservadoAte" = now() + interval '30 min' where id = $2`,
  [pagId, ag.id]);
console.log(`cobranca de R$ ${sinal} (sinal de 30% sobre ${sv.preco})\n`);

console.log("1. webhook avisa PAGO");
let [r] = await q(
  `select public.registrar_desfecho_pagamento($1, 'PAGO', 'mp-12345',
     '{"status":"approved"}'::jsonb) x`, [pagId]);
console.log("   ", JSON.stringify(r.x));
let [a] = await q(
  `select status, "confirmadoEm" is not null conf, "reservadoAte"
   from public.agendamentos where id = $1`, [ag.id]);
console.log(`    ${a.status}, confirmado=${a.conf}, reserva solta=${a.reservadoAte === null}`);
console.log(`    ${a.status === "CONFIRMADO" && a.conf && a.reservadoAte === null
  ? "CORRETO" : "ERRADO"}`);

console.log("\n2. o provedor reenvia a MESMA notificacao");
[r] = await q(
  `select public.registrar_desfecho_pagamento($1, 'PAGO', 'mp-12345', null) x`, [pagId]);
console.log("   ", JSON.stringify(r.x),
  r.x.repetido ? "— CORRETO, nao reprocessou" : "— REPROCESSOU (erro)");
const [al] = await q(
  `select count(*)::int n from public.alertas
   where titulo like '%agendamento #' || $1`, [String(ag.numero)]);
console.log(`    alertas gerados: ${al.n} ${al.n === 1 ? "(CORRETO)" : "(DUPLICOU)"}`);

console.log("\n3. pagamento recusado");
const ag2 = await criar("Teste Recusado", 30);
const pag2 = crypto.randomUUID();
await q(
  `insert into public.pagamentos_online (id, "agendamentoId", provedor, status, valor)
   values ($1, $2, 'MERCADO_PAGO', 'PENDENTE', 50)`, [pag2, ag2.id]);
await q(`select public.registrar_desfecho_pagamento($1, 'RECUSADO', 'mp-999', null)`,
  [pag2]);
const [a2] = await q(
  `select status, "motivoCancelamento" m from public.agendamentos where id = $1`,
  [ag2.id]);
console.log(`    ${a2.status} — "${a2.m}" ${
  a2.status === "CANCELADO" ? "(CORRETO: horario liberado)" : "(ERRADO)"}`);

console.log("\n4. reserva vencida sem pagamento");
const ag3 = await criar("Teste Abandonado", 34, new Date(Date.now() - 5 * 60_000).toISOString());
const [lib] = await q(`select public.liberar_reservas_vencidas() n`);
const [a3] = await q(`select status from public.agendamentos where id = $1`, [ag3.id]);
console.log(`    ${lib.n} liberada(s); ficou ${a3.status} ${
  a3.status === "CANCELADO" ? "(CORRETO)" : "(ERRADO)"}`);

await q(`delete from public.alertas where titulo like '%Teste %'
         or titulo like '%agendamento #%'`);
await q(`delete from public.pagamentos_online where "agendamentoId" in
         (select id from public.agendamentos where nome like 'Teste %')`);
await q(`delete from public.agendamentos where nome like 'Teste %'`);
console.log("\nlimpeza concluida");
await c.end();
