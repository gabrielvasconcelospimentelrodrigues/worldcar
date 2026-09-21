import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sincronizarPendencias } from "@/lib/negocio";
import { TituloPagina } from "@/components/ui";
import { fimDoDia, inicioDoDia, somaDias } from "@/lib/format";
import { ListaAlertas, type AlertaItem } from "./lista";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alertas" };

export default async function AlertasPage() {
  await exigirModulo("alertas");
  await sincronizarPendencias();

  const incluir = {
    cliente: { select: { id: true, nome: true, telefone: true } },
    veiculo: { select: { placa: true } },
    ordem: { select: { id: true, numero: true } },
  };

  const [pendentes, concluidos, clientes] = await Promise.all([
    prisma.alerta.findMany({
      where: { status: "PENDENTE" },
      include: incluir,
      orderBy: { dataAlvo: "asc" },
      take: 200,
    }),
    prisma.alerta.findMany({
      where: { status: "CONCLUIDO" },
      include: incluir,
      orderBy: { concluidoEm: "desc" },
      take: 10,
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  const inicioHoje = inicioDoDia();
  const fimHoje = fimDoDia();
  const fimSemana = fimDoDia(somaDias(new Date(), 7));

  const lista = pendentes as unknown as AlertaItem[];

  return (
    <>
      <TituloPagina
        titulo="Alertas"
        descricao="Retornos de garantia, pós-venda e lembretes. Gerados automaticamente ao entregar uma OS."
      />
      <ListaAlertas
        vencidos={lista.filter((a) => a.dataAlvo < inicioHoje)}
        hoje={lista.filter((a) => a.dataAlvo >= inicioHoje && a.dataAlvo <= fimHoje)}
        proximos={lista.filter((a) => a.dataAlvo > fimHoje && a.dataAlvo <= fimSemana)}
        futuros={lista.filter((a) => a.dataAlvo > fimSemana)}
        concluidos={concluidos as unknown as AlertaItem[]}
        clientes={clientes}
      />
    </>
  );
}
