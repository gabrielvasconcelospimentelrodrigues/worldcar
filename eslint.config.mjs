import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // O <Image> do @react-pdf/renderer desenha num PDF, nao no DOM: nao existe
    // prop `alt` nele, entao a regra de acessibilidade de <img> nao se aplica.
    files: ["src/lib/pdf/**/*.tsx"],
    rules: { "jsx-a11y/alt-text": "off" },
  },
];

export default eslintConfig;
