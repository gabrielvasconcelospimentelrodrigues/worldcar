import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TituloPagina } from "@/components/ui";
import { num } from "@/lib/format";
import { GerenciadorServicos } from "./gerenciador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogo de serviços" };

export default async function ServicosPage() {
  await exigirModulo("servicos");

  const servicos = await prisma.servico.findMany({
    orderBy: [{ ativo: "desc" }, { categoria: "asc" }, { nome: "asc" }],
  });

  // Decimal do Prisma nao atravessa a fronteira servidor->cliente; converte para number.
  const serializados = servicos.map((s) => ({
    ...s,
    preco: num(s.preco),
    custo: num(s.custo),
    comissaoPct: num(s.comissaoPct),
  }));

  return (
    <>
      <TituloPagina
        titulo="Catálogo de serviços"
        descricao="Preço, prazo, garantia e comissão de cada serviço. É a base dos orçamentos."
      />
      <GerenciadorServicos servicos={serializados} />
    </>
  );
}
