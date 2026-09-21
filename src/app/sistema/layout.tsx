import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navegacao } from "@/components/sistema/navegacao";

export const metadata = { title: "Sistema" };
export const dynamic = "force-dynamic";

export default async function SistemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  // Contador de alertas vencidos/para hoje, exibido no menu lateral.
  let alertasPendentes = 0;
  try {
    const fimDeHoje = new Date();
    fimDeHoje.setHours(23, 59, 59, 999);
    alertasPendentes = await prisma.alerta.count({
      where: { status: "PENDENTE", dataAlvo: { lte: fimDeHoje } },
    });
  } catch {
    // banco indisponivel: o menu segue funcionando sem o contador
  }

  return (
    <div className="min-h-screen bg-carvao-50">
      <Navegacao sessao={sessao} alertasPendentes={alertasPendentes} />
      <div className="lg:pl-60">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
