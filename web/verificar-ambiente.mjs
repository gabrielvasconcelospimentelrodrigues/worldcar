/**
 * Confere as variaveis antes de construir.
 *
 * O Vite embute `VITE_*` no pacote em tempo de BUILD. Se elas faltarem, a
 * construcao termina com sucesso e o site sobe — mas abre em tela branca,
 * porque o cliente do Supabase so descobre a falta quando ja esta no navegador
 * do usuario. Publicar quebrado e pior do que nao publicar: o erro aparece para
 * o cliente, nao para quem pode corrigir.
 *
 * Roda antes do `vite build`; ver o `build` no package.json.
 */
import path from "node:path";

/**
 * Quem le o `.env.local` e o Vite, nao o Node — na primeira versao deste
 * arquivo a checagem reprovava sempre na maquina local, mesmo com o arquivo
 * correto ao lado. Na Vercel nao ha `.env.local`: as variaveis chegam pelo
 * ambiente, e o `try` cobre a ausencia do arquivo.
 */
for (const arquivo of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), arquivo));
  } catch {
    /* ausente: segue com o que estiver no ambiente */
  }
}
const OBRIGATORIAS = [
  ["VITE_SUPABASE_URL", "endereco do projeto no Supabase"],
  ["VITE_SUPABASE_ANON_KEY", "chave anonima do projeto"],
];

const faltando = OBRIGATORIAS.filter(([nome]) => !process.env[nome]?.trim());

if (faltando.length > 0) {
  console.error("\n  Build interrompido: faltam variaveis de ambiente.\n");
  for (const [nome, para] of faltando) {
    console.error(`    ${nome}  — ${para}`);
  }
  console.error(
    "\n  Local:  defina em web/.env.local" +
    "\n  Vercel: Settings > Environment Variables\n" +
    "\n  As duas sao publicas por natureza: viajam no pacote que o navegador" +
    "\n  baixa. Quem protege os dados e a RLS no banco, nao o sigilo delas.\n",
  );
  process.exit(1);
}

// Erro de digitacao comum: colar a URL do REST em vez da do projeto.
const url = process.env.VITE_SUPABASE_URL.trim();
if (url.includes("/rest/v1")) {
  console.error(
    `\n  VITE_SUPABASE_URL nao deve conter "/rest/v1".` +
    `\n  Use so o endereco do projeto: https://SEU-PROJETO.supabase.co\n`,
  );
  process.exit(1);
}

console.log("Variaveis de ambiente conferidas.");
