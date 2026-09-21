import "server-only";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/format";
import type { ClienteOpcao, ServicoOpcao } from "./editor";

/** Opcoes de cliente/veiculo e catalogo, ja serializados para o editor. */
export async function opcoesDoEditor(): Promise<{
  clientes: ClienteOpcao[];
  servicos: ServicoOpcao[];
}> {
  const [clientes, servicos] = await Promise.all([
    prisma.cliente.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        telefone: true,
        veiculos: {
          select: { id: true, placa: true, marca: true, modelo: true, km: true },
          orderBy: { placa: "asc" },
        },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    }),
  ]);

  return {
    clientes,
    servicos: servicos.map((s) => ({
      id: s.id,
      codigo: s.codigo,
      nome: s.nome,
      categoria: s.categoria,
      preco: num(s.preco),
      garantiaDias: s.garantiaDias,
      descricao: s.descricao,
    })),
  };
}

/** Funcionarios ativos, para os seletores de entrada/saida e responsavel. */
export async function funcionariosAtivos() {
  return prisma.funcionario.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, cargo: true, setor: true },
    orderBy: { nome: "asc" },
  });
}
