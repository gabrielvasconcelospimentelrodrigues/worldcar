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
  server: { port: 3000 },
});
