import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { lerSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { num, numeroDoc } from "@/lib/format";
import { dadosEmpresa } from "@/lib/pdf/comum";
import { DocumentoOrdem } from "@/lib/pdf/ordem-pdf";

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

  const os = await prisma.ordemServico.findUnique({
    where: { id },
    include: {
      cliente: true,
      veiculo: true,
      funcionarioEntrada: true,
      funcionarioSaida: true,
      itens: { include: { responsavel: true }, orderBy: { id: "asc" } },
    },
  });

  if (!os) {
    return NextResponse.json({ erro: "Ordem de serviço não encontrada." }, { status: 404 });
  }

  const empresa = await dadosEmpresa();

  const buffer = await renderToBuffer(
    DocumentoOrdem({
      empresa,
      ordem: {
        numero: os.numero,
        status: os.status,
        dataEntrada: os.dataEntrada,
        dataSaida: os.dataSaida,
        funcionarioEntrada: os.funcionarioEntrada.nome,
        funcionarioSaida: os.funcionarioSaida?.nome ?? null,
        kmEntrada: os.kmEntrada,
        kmSaida: os.kmSaida,
        combustivelEntrada: os.combustivelEntrada,
        observacoesEntrada: os.observacoesEntrada,
        observacoesSaida: os.observacoesSaida,
        clienteRetirou: os.clienteRetirou,
        documentoRetirada: os.documentoRetirada,
        assinaturaEntrega: os.assinaturaEntrega,
        previsaoEntrega: os.previsaoEntrega,
        cliente: {
          nome: os.cliente.nome,
          documento: os.cliente.documento,
          telefone: os.cliente.telefone,
          endereco: os.cliente.endereco,
        },
        veiculo: {
          placa: os.veiculo.placa,
          marca: os.veiculo.marca,
          modelo: os.veiculo.modelo,
          ano: os.veiculo.ano,
          cor: os.veiculo.cor,
        },
        itens: os.itens.map((i) => ({
          descricao: i.descricao,
          quantidade: num(i.quantidade),
          precoUnit: num(i.precoUnit),
          total: num(i.total),
          status: i.status,
          responsavel: i.responsavel?.nome ?? null,
          garantiaDias: i.garantiaDias,
        })),
        subtotal: num(os.subtotal),
        desconto: num(os.desconto),
        total: num(os.total),
        observacoes: os.observacoes,
      },
    }),
  );

  const nome = `os-${numeroDoc(os.numero)}-${os.veiculo.placa}.pdf`;
  const baixar = new URL(req.url).searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
