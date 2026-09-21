import { useEffect, useState, type FormEvent } from "react";
import {
  AreaTexto, Aviso, Botao, CabecalhoCartao, Campo, CampoMascara, Cartao,
  TituloPagina,
} from "@/componentes/ui";
import { BlocoEndereco } from "@/componentes/bloco-endereco";
import { EMPRESA } from "@/lib/empresa-info";
import { dadosEmpresa } from "@/lib/consultas";
import { ConfigAgenda } from "@/componentes/config-agenda";
import { mensagemErro, sb } from "@/lib/supabase";
import type { Empresa } from "@/lib/tipos";
import { mascararDocumento, mascararTelefone, soDigitos } from "@/lib/mascaras";

type AbaConfig = "empresa" | "agenda";

export function Configuracoes() {
  const [abaConfig, setAbaConfig] = useState<AbaConfig>("empresa");
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void dadosEmpresa().then((e) => {
      if (!vivo) return;
      setEmpresa(e);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, []);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setOk(null);

    const f = new FormData(e.currentTarget);
    const vazio = (k: string) => String(f.get(k) ?? "").trim() || null;

    const { error } = await sb.from("empresa").upsert({
      id: "default",
      nome: String(f.get("nome") ?? "").trim(),
      cnpj: vazio("cnpj"),
      telefone: vazio("telefone"),
      whatsapp: vazio("whatsapp"),
      email: vazio("email"),
      endereco: vazio("endereco"),
      cidade: vazio("cidade"),
      uf: vazio("uf")?.toUpperCase() ?? null,
      cep: vazio("cep"),
      instagram: vazio("instagram"),
      observacoesOrcamento: vazio("observacoesOrcamento"),
      atualizadoEm: new Date().toISOString(),
    });

    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    setOk("Dados salvos. Os próximos PDFs já usam este cabeçalho.");
    setEmpresa(await dadosEmpresa());
  }

  if (carregando) {
    return <p className="py-12 text-center text-sm text-carvao-500">Carregando...</p>;
  }

  return (
    <>
      <TituloPagina titulo="Configurações"
        descricao="Dados da empresa e regras da agenda." />

      <nav aria-label="Seções das configurações" className="mb-6 flex flex-wrap gap-2">
        {([["empresa", "Empresa"], ["agenda", "Agenda"]] as const).map(([k, r]) => (
          <button key={k} type="button" onClick={() => setAbaConfig(k)}
            aria-current={abaConfig === k ? "page" : undefined}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              abaConfig === k
                ? "bg-carvao-950 text-white"
                : "border border-carvao-300 bg-white text-carvao-700 hover:border-carvao-500"}`}>
            {r}
          </button>
        ))}
      </nav>

      {abaConfig === "agenda" && <ConfigAgenda />}

      {abaConfig === "empresa" && (
      <>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Cartao>
          <CabecalhoCartao titulo="Dados da empresa" />
          <form onSubmit={salvar} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-6">
              <Campo rotulo="Nome da empresa" name="nome" required className="sm:col-span-4"
                defaultValue={empresa?.nome ?? EMPRESA.nome} />
              <CampoMascara rotulo="CNPJ" name="cnpj" className="sm:col-span-2"
              mascara={mascararDocumento} limpar={soDigitos} inputMode="numeric"
                defaultValue={empresa?.cnpj ?? ""} />
              <CampoMascara rotulo="Telefone" name="telefone" className="sm:col-span-2"
              mascara={mascararTelefone} limpar={soDigitos} inputMode="tel"
                defaultValue={empresa?.telefone ?? EMPRESA.telefone} />
              <CampoMascara rotulo="WhatsApp" name="whatsapp" className="sm:col-span-2"
              mascara={mascararTelefone} limpar={soDigitos} inputMode="tel"
                defaultValue={empresa?.whatsapp ?? EMPRESA.whatsapp} />
              <Campo rotulo="E-mail" name="email" type="email" className="sm:col-span-2"
                defaultValue={empresa?.email ?? ""} />
              <Campo rotulo="Instagram" name="instagram" className="sm:col-span-2"
                defaultValue={empresa?.instagram ?? EMPRESA.instagramHandle} />
              <AreaTexto rotulo="Observações padrão do orçamento" name="observacoesOrcamento"
                rows={3} className="sm:col-span-6"
                defaultValue={empresa?.observacoesOrcamento ?? ""}
                placeholder="Cláusulas fixas que devem sair em todo orçamento." />
            </div>

            <BlocoEndereco
              titulo="Endereço da empresa"
              inicial={{
                cep: empresa?.cep ?? EMPRESA.cep,
                endereco: empresa?.endereco ?? `${EMPRESA.endereco} — ${EMPRESA.bairro}`,
                cidade: empresa?.cidade ?? EMPRESA.cidade,
                uf: empresa?.uf ?? EMPRESA.uf,
              }}
            />

            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            {ok && <Aviso tipo="sucesso">{ok}</Aviso>}

            <div className="flex justify-end border-t border-carvao-200 pt-4">
              <Botao type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar dados"}
              </Botao>
            </div>
          </form>
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
            <li><strong className="text-carvao-900">Loja</strong> — arquivo interno, com todos os valores.</li>
            <li><strong className="text-carvao-900">Produção</strong> — para a equipe técnica, sem valores.</li>
            <li><strong className="text-carvao-900">Cliente</strong> — com campo de assinatura.</li>
          </ul>
          <p className="mt-4 rounded-md border border-carvao-200 bg-carvao-50 p-3 text-xs text-carvao-600">
            Os PDFs são montados no próprio aparelho, sem passar por servidor — funcionam
            mesmo com a internet da oficina instável.
          </p>
        </Cartao>
      </div>
      </>
      )}
    </>
  );
}
