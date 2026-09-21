import type { Metadata } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { EMPRESA, enderecoCompleto } from "@/lib/empresa-info";

const inter = Inter({
  variable: "--font-corpo",
  subsets: ["latin"],
  display: "swap",
});

const titulo = Barlow_Condensed({
  variable: "--font-titulo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${EMPRESA.nome} — Estética Automotiva, Funilaria e Revitalização em Curitiba`,
    template: `%s · ${EMPRESA.nome}`,
  },
  description: EMPRESA.descricaoCurta,
  keywords: [
    "estética automotiva Curitiba",
    "funilaria Curitiba",
    "insulfilm Curitiba",
    "vitrificação de pintura",
    "revitalização de faróis",
    "lava a jato Campo Comprido",
  ],
  openGraph: {
    title: `${EMPRESA.nome} — ${EMPRESA.slogan}`,
    description: EMPRESA.descricaoCurta,
    locale: "pt_BR",
    type: "website",
    siteName: EMPRESA.nome,
  },
  other: { "format-detection": "telephone=no" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const dadosEstruturados = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: EMPRESA.nome,
    description: EMPRESA.descricaoCurta,
    telephone: EMPRESA.telefone,
    address: {
      "@type": "PostalAddress",
      streetAddress: EMPRESA.endereco,
      addressLocality: `${EMPRESA.bairro}, ${EMPRESA.cidade}`,
      addressRegion: EMPRESA.uf,
      postalCode: EMPRESA.cep,
      addressCountry: "BR",
    },
    sameAs: [EMPRESA.instagram],
    areaServed: `${EMPRESA.cidade}/${EMPRESA.uf}`,
    slogan: EMPRESA.slogan,
  };

  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${titulo.variable} font-sans antialiased`}>
        {children}
        <script
          type="application/ld+json"
          // dados institucionais fixos, nao vem de entrada do usuario
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados) }}
        />
        <span className="sr-only">{enderecoCompleto()}</span>
      </body>
    </html>
  );
}
