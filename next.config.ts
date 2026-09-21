import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp e o @react-pdf/renderer carregam binarios e fontes em tempo de
  // execucao; empacota-los quebra na Vercel. Ficam como dependencia externa
  // do servidor, resolvida em node_modules.
  serverExternalPackages: ["sharp", "@react-pdf/renderer"],
};

export default nextConfig;
