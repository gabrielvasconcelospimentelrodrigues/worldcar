import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { exigirModulo } from "@/lib/auth";
import {
  Badge,
  BotaoLink,
  Cartao,
  LinhaVazia,
  Tabela,
  Td,
  Th,
  TituloPagina,
} from "@/components/ui";
import { data, documento, telefone } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await exigirModulo("clientes");
  const { q } = await searchParams;
  const busca = q?.trim() ?? "";

  const clientes = await prisma.cliente.findMany({
    where: busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" } },
            { telefone: { contains: busca } },
            { documento: { contains: busca.replace(/\D/g, "") } },
            { veiculos: { some: { placa: { contains: busca.toUpperCase() } } } },
          ],
        }
      : undefined,
    include: {
      veiculos: { select: { placa: true, marca: true, modelo: true } },
      _count: { select: { ordens: true } },
    },
    orderBy: { nome: "asc" },
    take: 100,
  });

  return (
    <>
      <TituloPagina
        titulo="Clientes e veículos"
        descricao="Cadastro base para orçamentos e ordens de serviço."
        acao={
          <BotaoLink href="/sistema/clientes/novo">
            <Plus className="h-4 w-4" aria-hidden />
            Novo cliente
          </BotaoLink>
        }
      />

      <Cartao className="mb-4 p-4">
        <form className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carvao-400"
              aria-hidden
            />
            <input
              name="q"
              defaultValue={busca}
              placeholder="Buscar por nome, telefone, CPF/CNPJ ou placa..."
              aria-label="Buscar cliente"
              className="w-full rounded-md border border-carvao-300 py-2 pl-9 pr-3 text-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-carvao-950 px-5 text-sm font-semibold text-white hover:bg-carvao-800"
          >
            Buscar
          </button>
        </form>
      </Cartao>

      <Cartao>
        <Tabela>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Contato</Th>
              <Th>Veículos</Th>
              <Th className="text-center">OS</Th>
              <Th>Cadastro</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 && (
              <LinhaVazia
                colunas={6}
                mensagem={
                  busca
                    ? `Nenhum cliente encontrado para "${busca}".`
                    : "Nenhum cliente cadastrado ainda."
                }
              />
            )}
            {clientes.map((c) => (
              <tr key={c.id} className="hover:bg-carvao-50">
                <Td>
                  <Link
                    href={`/sistema/clientes/${c.id}`}
                    className="font-semibold text-carvao-950 hover:text-marca-600"
                  >
                    {c.nome}
                  </Link>
                  <p className="text-xs text-carvao-500">
                    {c.tipo === "JURIDICA" ? "PJ" : "PF"}
                    {c.documento && ` · ${documento(c.documento)}`}
                  </p>
                  {!c.ativo && (
                    <Badge cor="bg-carvao-300 text-carvao-700" className="mt-1">
                      Inativo
                    </Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  <p>{telefone(c.telefone)}</p>
                  {c.email && <p className="text-xs text-carvao-500">{c.email}</p>}
                </Td>
                <Td>
                  {c.veiculos.length === 0 ? (
                    <span className="text-carvao-400">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {c.veiculos.slice(0, 3).map((v) => (
                        <Badge key={v.placa} cor="bg-carvao-100 text-carvao-700">
                          {v.placa}
                        </Badge>
                      ))}
                      {c.veiculos.length > 3 && (
                        <Badge cor="bg-carvao-100 text-carvao-500">
                          +{c.veiculos.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </Td>
                <Td className="text-center font-semibold">{c._count.ordens}</Td>
                <Td className="whitespace-nowrap text-carvao-500">{data(c.criadoEm)}</Td>
                <Td className="text-right">
                  <Link
                    href={`/sistema/clientes/${c.id}`}
                    className="text-sm font-semibold text-marca-600 hover:underline"
                  >
                    Abrir
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Cartao>

      {clientes.length === 100 && (
        <p className="mt-3 text-center text-xs text-carvao-500">
          Exibindo os 100 primeiros. Refine a busca para ver outros.
        </p>
      )}
    </>
  );
}
