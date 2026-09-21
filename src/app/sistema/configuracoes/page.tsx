import { exigirPapel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Cartao, CabecalhoCartao, TituloPagina } from "@/components/ui";
import { EMPRESA } from "@/lib/empresa-info";
import { FormularioEmpresa } from "./formulario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await exigirPapel("ADMIN");

  const empresa = await prisma.empresa.findUnique({ where: { id: "default" } });

  return (
    <>
      <TituloPagina
        titulo="Configurações"
        descricao="Dados que aparecem no cabeçalho dos PDFs de orçamento, OS e vistoria."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Cartao>
          <CabecalhoCartao titulo="Dados da empresa" />
          <FormularioEmpresa
            empresa={
              empresa ?? {
                nome: EMPRESA.nome,
                cnpj: null,
                telefone: EMPRESA.telefone,
                whatsapp: EMPRESA.whatsapp,
                email: null,
                endereco: `${EMPRESA.endereco} — ${EMPRESA.bairro}`,
                cidade: EMPRESA.cidade,
                uf: EMPRESA.uf,
                cep: EMPRESA.cep,
                instagram: EMPRESA.instagramHandle,
                observacoesOrcamento: null,
              }
            }
          />
        </Cartao>

        <Cartao className="p-5">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight text-carvao-950">
            Sobre os documentos
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-carvao-600">
            Todo orçamento, ordem de serviço e vistoria gera um PDF com três páginas — uma
            para cada via:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-carvao-600">
            <li>
              <strong className="text-carvao-900">Loja</strong> — arquivo interno, com
              todos os valores.
            </li>
            <li>
              <strong className="text-carvao-900">Produção</strong> — para a equipe
              técnica, sem valores, só o que executar.
            </li>
            <li>
              <strong className="text-carvao-900">Cliente</strong> — com campo de
              assinatura.
            </li>
          </ul>
          <p className="mt-4 rounded-md border border-carvao-200 bg-carvao-50 p-3 text-xs text-carvao-600">
            O texto de <strong>observações padrão</strong> é anexado ao aviso legal no
            rodapé de todo orçamento. Use para cláusulas fixas de garantia ou política da
            loja.
          </p>
        </Cartao>
      </div>
    </>
  );
}
