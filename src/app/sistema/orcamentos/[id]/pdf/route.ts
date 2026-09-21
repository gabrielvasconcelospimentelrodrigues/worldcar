import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { lerSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { num, numeroDoc } from "@/lib/format";
import { dadosEmpresa } from "@/lib/pdf/comum";
import { DocumentoOrcamento } from "@/lib/pdf/orcamento-pdf";

// @react-pdf/renderer precisa do runtime Node (nao roda no edge).
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

  const orc = await prisma.orcamento.findUnique({
    where: { id },
    include: {
      cliente: true,
      veiculo: true,
      vendedor: true,
      itens: { include: { servico: true }, orderBy: { ordem: "asc" } },
    },
  });

  if (!orc) {
    return NextResponse.json({ erro: "Orçamento não encontrado." }, { status: 404 });
  }

  const empresa = await dadosEmpresa();

  const buffer = await renderToBuffer(
    DocumentoOrcamento({
      empresa,
      orcamento: {
        numero: orc.numero,
        criadoEm: orc.criadoEm,
        validoAte: orc.validoAte,
        status: orc.status,
        cliente: {
          nome: orc.cliente.nome,
          documento: orc.cliente.documento,
          telefone: orc.cliente.telefone,
          email: orc.cliente.email,
          endereco: orc.cliente.endereco
            ? `${orc.cliente.endereco}${orc.cliente.numero ? `, ${orc.cliente.numero}` : ""}${
                orc.cliente.bairro ? ` — ${orc.cliente.bairro}` : ""
              }${orc.cliente.cidade ? `, ${orc.cliente.cidade}/${orc.cliente.uf ?? ""}` : ""}`
            : null,
        },
        veiculo: {
          placa: orc.veiculo.placa,
          marca: orc.veiculo.marca,
          modelo: orc.veiculo.modelo,
          ano: orc.veiculo.ano,
          cor: orc.veiculo.cor,
        },
        kmVeiculo: orc.kmVeiculo,
        vendedor: orc.vendedor?.nome ?? null,
        itens: orc.itens.map((i) => ({
          descricao: i.descricao,
          quantidade: num(i.quantidade),
          precoUnit: num(i.precoUnit),
          desconto: num(i.desconto),
          total: num(i.total),
          garantiaDias: i.servico?.garantiaDias ?? 0,
        })),
        subtotal: num(orc.subtotal),
        desconto: num(orc.desconto),
        total: num(orc.total),
        prazoEntregaDias: orc.prazoEntregaDias,
        formaPagamento: orc.formaPagamento,
        observacoes: orc.observacoes,
      },
    }),
  );

  const nome = `orcamento-${numeroDoc(orc.numero)}-${orc.veiculo.placa}.pdf`;
  // ?download=1 forca o "salvar como"; sem o parametro abre no visualizador.
  const baixar = new URL(req.url).searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
