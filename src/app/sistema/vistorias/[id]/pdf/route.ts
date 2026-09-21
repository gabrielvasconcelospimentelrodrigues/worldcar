import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { lerSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { numeroDoc } from "@/lib/format";
import type { EstadoItemVistoria } from "@/lib/constantes";
import { fotosParaPdf } from "@/lib/storage";
import { dadosEmpresa } from "@/lib/pdf/comum";
import { DocumentoVistoria } from "@/lib/pdf/vistoria-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const v = await prisma.vistoria.findUnique({
    where: { id },
    include: {
      funcionario: true,
      ordem: { include: { cliente: true, veiculo: true } },
      fotos: { orderBy: { criadoEm: "asc" } },
    },
  });

  if (!v) {
    return NextResponse.json({ erro: "Vistoria não encontrada." }, { status: 404 });
  }

  const empresa = await dadosEmpresa();

  // As fotos entram como data URL: o PDF continua valido depois que a URL
  // assinada do bucket expira. `fotosParaPdf` respeita um teto de quantidade e
  // de bytes; uma foto que falhe ao baixar e omitida em vez de derrubar o
  // documento inteiro.
  const { embutidas, omitidas } = await fotosParaPdf(v.fotos);

  const buffer = await renderToBuffer(
    DocumentoVistoria({
      empresa,
      vistoria: {
        assinaturaCliente: v.assinaturaCliente,
        fotos: embutidas,
        fotosOmitidas: omitidas,
        tipo: v.tipo,
        data: v.data,
        km: v.km,
        combustivel: v.combustivel,
        vistoriador: v.funcionario.nome,
        pertences: v.pertences,
        observacoes: v.observacoes,
        aprovadaCliente: v.aprovadaCliente,
        checklist: (v.checklist ?? {}) as Record<string, EstadoItemVistoria>,
        avarias: (Array.isArray(v.avarias) ? v.avarias : []) as unknown as {
          local: string;
          descricao: string;
          gravidade: string;
        }[],
        ordem: {
          numero: v.ordem.numero,
          cliente: {
            nome: v.ordem.cliente.nome,
            documento: v.ordem.cliente.documento,
            telefone: v.ordem.cliente.telefone,
          },
          veiculo: {
            placa: v.ordem.veiculo.placa,
            marca: v.ordem.veiculo.marca,
            modelo: v.ordem.veiculo.modelo,
            ano: v.ordem.veiculo.ano,
            cor: v.ordem.veiculo.cor,
          },
        },
      },
    }),
  );

  const nome = `vistoria-${v.tipo.toLowerCase()}-os${numeroDoc(v.ordem.numero)}-${
    v.ordem.veiculo.placa
  }.pdf`;
  const baixar = new URL(req.url).searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
