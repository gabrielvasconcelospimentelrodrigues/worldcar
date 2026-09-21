"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dec, totalItem, totalizar } from "@/lib/negocio";
import { somaDias } from "@/lib/format";

export type Estado = { erro?: string; ok?: string };

const itemSchema = z.object({
  servicoId: z.string().optional().nullable(),
  descricao: z.string().trim().min(1, "Descreva o item."),
  quantidade: z.coerce.number().min(0.01, "Quantidade inválida."),
  precoUnit: z.coerce.number().min(0, "Preço inválido."),
  desconto: z.coerce.number().min(0),
  garantiaDias: z.coerce.number().int().min(0).default(0),
});

const orcamentoSchema = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  veiculoId: z.string().min(1, "Selecione o veículo."),
  validadeDias: z.coerce.number().int().min(1).max(365),
  kmVeiculo: z.string().optional(),
  descontoTipo: z.enum(["VALOR", "PERCENTUAL"]),
  desconto: z.coerce.number().min(0),
  prazoEntregaDias: z.string().optional(),
  formaPagamento: z.string().trim().max(120).optional(),
  observacoes: z.string().trim().max(2000).optional(),
  itens: z.array(itemSchema).min(1, "Adicione pelo menos um item ao orçamento."),
});

export async function salvarOrcamentoAction(
  _estado: Estado,
  dados: FormData,
): Promise<Estado> {
  const sessao = await exigirModulo("orcamentos");

  const id = String(dados.get("id") ?? "");
  let itensBrutos: unknown;
  try {
    itensBrutos = JSON.parse(String(dados.get("itens") ?? "[]"));
  } catch {
    return { erro: "Falha ao ler os itens do orçamento." };
  }

  const r = orcamentoSchema.safeParse({
    clienteId: dados.get("clienteId") ?? "",
    veiculoId: dados.get("veiculoId") ?? "",
    validadeDias: dados.get("validadeDias") ?? 10,
    kmVeiculo: dados.get("kmVeiculo") ?? "",
    descontoTipo: dados.get("descontoTipo") ?? "VALOR",
    desconto: dados.get("desconto") ?? 0,
    prazoEntregaDias: dados.get("prazoEntregaDias") ?? "",
    formaPagamento: dados.get("formaPagamento") ?? "",
    observacoes: dados.get("observacoes") ?? "",
    itens: itensBrutos,
  });
  if (!r.success) return { erro: r.error.issues[0].message };

  const v = r.data;
  const { subtotal, total } = totalizar(v.itens, v.descontoTipo, v.desconto);

  const cabecalho = {
    clienteId: v.clienteId,
    veiculoId: v.veiculoId,
    validadeDias: v.validadeDias,
    validoAte: somaDias(new Date(), v.validadeDias),
    kmVeiculo: v.kmVeiculo ? Number(v.kmVeiculo.replace(/\D/g, "")) || null : null,
    subtotal: dec(subtotal),
    descontoTipo: v.descontoTipo,
    desconto: dec(v.desconto),
    total: dec(total),
    prazoEntregaDias: v.prazoEntregaDias ? Number(v.prazoEntregaDias) || null : null,
    formaPagamento: v.formaPagamento?.trim() || null,
    observacoes: v.observacoes?.trim() || null,
  };

  const itens = v.itens.map((i, idx) => ({
    servicoId: i.servicoId || null,
    descricao: i.descricao,
    quantidade: dec(i.quantidade),
    precoUnit: dec(i.precoUnit),
    desconto: dec(i.desconto),
    total: dec(totalItem(i)),
    ordem: idx,
  }));

  let destino: string;
  try {
    if (id) {
      const atual = await prisma.orcamento.findUnique({ where: { id } });
      if (!atual) return { erro: "Orçamento não encontrado." };
      if (atual.status === "CONVERTIDO") {
        return { erro: "Orçamento já convertido em OS não pode ser alterado." };
      }

      // Itens sao substituidos por completo: mais simples e evita orfaos.
      await prisma.$transaction([
        prisma.orcamentoItem.deleteMany({ where: { orcamentoId: id } }),
        prisma.orcamento.update({
          where: { id },
          data: { ...cabecalho, itens: { create: itens } },
        }),
      ]);
      destino = `/sistema/orcamentos/${id}`;
    } else {
      const novo = await prisma.orcamento.create({
        data: {
          ...cabecalho,
          status: "RASCUNHO",
          vendedorId: sessao.funcionarioId,
          itens: { create: itens },
        },
      });
      destino = `/sistema/orcamentos/${novo.id}`;
    }
  } catch {
    return { erro: "Não foi possível salvar o orçamento." };
  }

  revalidatePath("/sistema/orcamentos");
  redirect(destino);
}

export async function mudarStatusOrcamentoAction(dados: FormData) {
  await exigirModulo("orcamentos");
  const id = String(dados.get("id") ?? "");
  const status = String(dados.get("status") ?? "");
  const motivo = String(dados.get("motivo") ?? "").trim();

  const permitidos = ["RASCUNHO", "ENVIADO", "APROVADO", "RECUSADO"] as const;
  if (!id || !permitidos.includes(status as (typeof permitidos)[number])) return;

  await prisma.orcamento.update({
    where: { id },
    data: {
      status: status as (typeof permitidos)[number],
      aprovadoEm: status === "APROVADO" ? new Date() : null,
      motivoRecusa: status === "RECUSADO" ? motivo || null : null,
    },
  });

  revalidatePath(`/sistema/orcamentos/${id}`);
  revalidatePath("/sistema/orcamentos");
}

/**
 * Converte o orçamento aprovado em ordem de serviço.
 * O funcionário de entrada é obrigatório — é quem recebe o veículo.
 */
export async function converterEmOrdemAction(dados: FormData): Promise<void> {
  const sessao = await exigirModulo("ordens");
  const id = String(dados.get("id") ?? "");
  const funcionarioEntradaId = String(dados.get("funcionarioEntradaId") ?? "");
  const previsao = String(dados.get("previsaoEntrega") ?? "");
  const kmEntrada = String(dados.get("kmEntrada") ?? "");
  const combustivel = String(dados.get("combustivelEntrada") ?? "");

  if (!id || !funcionarioEntradaId) return;

  const orc = await prisma.orcamento.findUnique({
    where: { id },
    include: { itens: { include: { servico: true } } },
  });
  if (!orc || orc.status === "CONVERTIDO") return;

  const ordem = await prisma.ordemServico.create({
    data: {
      orcamentoId: orc.id,
      clienteId: orc.clienteId,
      veiculoId: orc.veiculoId,
      funcionarioEntradaId,
      kmEntrada: kmEntrada ? Number(kmEntrada.replace(/\D/g, "")) || null : null,
      combustivelEntrada: combustivel || null,
      previsaoEntrega: previsao ? new Date(`${previsao}T18:00:00`) : null,
      subtotal: orc.subtotal,
      desconto: orc.desconto,
      total: orc.total,
      observacoes: orc.observacoes,
      itens: {
        create: orc.itens.map((i) => ({
          servicoId: i.servicoId,
          descricao: i.descricao,
          quantidade: i.quantidade,
          precoUnit: i.precoUnit,
          desconto: i.desconto,
          total: i.total,
          garantiaDias: i.servico?.garantiaDias ?? 0,
        })),
      },
    },
  });

  await prisma.orcamento.update({
    where: { id },
    data: { status: "CONVERTIDO", aprovadoEm: orc.aprovadoEm ?? new Date() },
  });

  // Atualiza o KM do veiculo com a leitura da entrada.
  if (kmEntrada) {
    const km = Number(kmEntrada.replace(/\D/g, ""));
    if (km > 0) {
      await prisma.veiculo.update({ where: { id: orc.veiculoId }, data: { km } });
    }
  }

  void sessao;
  revalidatePath("/sistema/orcamentos");
  revalidatePath("/sistema/ordens");
  redirect(`/sistema/ordens/${ordem.id}`);
}

export async function excluirOrcamentoAction(dados: FormData) {
  await exigirModulo("orcamentos");
  const id = String(dados.get("id") ?? "");
  const orc = await prisma.orcamento.findUnique({ where: { id } });
  // So rascunhos podem sumir; o resto vira historico.
  if (!orc || orc.status !== "RASCUNHO") return;

  await prisma.orcamento.delete({ where: { id } });
  revalidatePath("/sistema/orcamentos");
  redirect("/sistema/orcamentos");
}
