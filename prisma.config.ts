import path from "node:path";
import { defineConfig } from "prisma/config";

// A presenca deste arquivo desliga o carregamento automatico de .env pelo
// Prisma, entao as variaveis precisam ser lidas aqui. .env.local tem prioridade,
// como no Next; .env serve de fallback (util em CI e na Vercel, onde as
// variaveis ja vem do ambiente e nenhum dos dois arquivos existe).
for (const arquivo of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), arquivo));
  } catch {
    // arquivo ausente: segue com o que ja estiver no ambiente
  }
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
