import { exigirModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Indicador, TituloPagina } from "@/components/ui";
import { brl, num, referenciaMes } from "@/lib/format";
import {
  PainelRH,
  type ComissaoItem,
  type FuncionarioItem,
  type OcorrenciaItem,
} from "./painel";

export const dynamic = "force-dynamic";
export const metadata = { title: "RH" };

export default async function RhPage() {
  const sessao = await exigirModulo("rh");

  const [funcionarios, ocorrencias, comissoes] = await Promise.all([
    prisma.funcionario.findMany({
      include: {
        usuario: { select: { id: true, email: true, papel: true, ativo: true } },
        _count: { select: { entradas: true, saidas: true, itensExecutados: true } },
      },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    }),
    prisma.ocorrenciaRH.findMany({
      include: { funcionario: { select: { nome: true } } },
      orderBy: { inicio: "desc" },
      take: 50,
    }),
    prisma.comissao.findMany({
      include: { funcionario: { select: { nome: true } } },
      orderBy: [{ referencia: "desc" }, { criadoEm: "desc" }],
      take: 100,
    }),
  ]);

  const ativos = funcionarios.filter((f) => f.ativo);
  const folha = ativos.reduce((s, f) => s + num(f.salario), 0);
  const ref = referenciaMes();
  const comissoesMes = comissoes
    .filter((c) => c.referencia === ref)
    .reduce((s, c) => s + num(c.valor), 0);
  const comissoesAPagar = comissoes
    .filter((c) => !c.pago)
    .reduce((s, c) => s + num(c.valor), 0);

  return (
    <>
      <TituloPagina
        titulo="Recursos humanos"
        descricao="Equipe, ocorrências, comissões e acesso ao sistema."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Funcionários ativos" valor={String(ativos.length)} />
        <Indicador rotulo="Folha mensal" valor={brl(folha)} detalhe="Somente salários" />
        <Indicador
          rotulo="Comissões do mês"
          valor={brl(comissoesMes)}
          detalhe={`Referência ${ref}`}
        />
        <Indicador
          rotulo="Comissões a pagar"
          valor={brl(comissoesAPagar)}
          destaque={comissoesAPagar > 0}
        />
      </div>

      <PainelRH
        ehAdmin={sessao.papel === "ADMIN"}
        funcionarios={
          funcionarios.map((f) => ({
            ...f,
            salario: num(f.salario),
            comissaoPct: num(f.comissaoPct),
          })) as unknown as FuncionarioItem[]
        }
        ocorrencias={ocorrencias as unknown as OcorrenciaItem[]}
        comissoes={
          comissoes.map((c) => ({
            ...c,
            valor: num(c.valor),
            baseCalculo: num(c.baseCalculo),
            percentual: num(c.percentual),
          })) as unknown as ComissaoItem[]
        }
      />
    </>
  );
}
