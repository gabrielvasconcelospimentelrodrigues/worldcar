import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  // O Tailwind entra pelo plugin acima. Sem este `postcss: {}` o Vite procura
  // uma config subindo as pastas e encontra a do app Next na raiz do repo.
  css: { postcss: {} },
  server: {
    // Porta fixa e propria da SPA.
    //
    // A 3000 e do app Next antigo, que continua rodando nesta maquina. Sem
    // `strictPort`, o Vite achava a porta ocupada e escorregava em silencio
    // para 3001, 3002, 3003 — e a cada reinicio o endereco mudava, com o risco
    // de abrir a versao velha sem perceber. Falhar alto e melhor: se a 3100
    // estiver ocupada, o erro aparece em vez de o endereco mudar sozinho.
    port: 3100,
    strictPort: true,
  },
});
