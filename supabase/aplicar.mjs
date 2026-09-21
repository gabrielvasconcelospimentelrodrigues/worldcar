/**
 * Aplica os arquivos .sql de supabase/migracoes na ordem do nome.
 *
 *   node supabase/aplicar.mjs            aplica tudo
 *   node supabase/aplicar.mjs 003        aplica so os que comecam com 003
 *
 * Usa DIRECT_URL (porta 5432): DDL e criacao de funcao nao passam pelo pooler
 * em modo transacao.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

for (const arquivo of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), arquivo));
  } catch {
    /* ausente: segue com o ambiente */
  }
}

const filtro = process.argv[2] ?? "";
const dir = path.join(process.cwd(), "supabase", "migracoes");
const arquivos = readdirSync(dir)
  .filter((f) => f.endsWith(".sql") && f.startsWith(filtro))
  .sort();

if (arquivos.length === 0) {
  console.error(`Nenhum .sql em ${dir}${filtro ? ` comecando com "${filtro}"` : ""}.`);
  process.exit(1);
}

const cliente = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await cliente.connect();
console.log(`conectado | aplicando ${arquivos.length} arquivo(s)\n`);

let falhou = false;
for (const nome of arquivos) {
  const sql = readFileSync(path.join(dir, nome), "utf8");
  const inicio = Date.now();
  try {
    // Cada arquivo em sua propria transacao: um erro nao deixa metade aplicada.
    await cliente.query("begin");
    await cliente.query(sql);
    await cliente.query("commit");
    console.log(`  OK      ${nome}  (${Date.now() - inicio} ms)`);
  } catch (e) {
    await cliente.query("rollback").catch(() => {});
    falhou = true;
    console.log(`  FALHOU  ${nome}`);
    console.log(`          ${e.message}`);
    if (e.position) {
      const ate = sql.slice(0, Number(e.position));
      console.log(`          linha ${ate.split("\n").length}`);
    }
    break;
  }
}

await cliente.end();
process.exit(falhou ? 1 : 0);
