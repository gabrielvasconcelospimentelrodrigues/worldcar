import { useRef, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { Campo } from "./ui";
import { buscarCep, cepCompleto, formatarCep } from "@/lib/cep";

export type ValoresEndereco = {
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
};

/**
 * Bloco de endereco com o CEP como porta de entrada.
 *
 * Digitou os 8 digitos, a consulta dispara sozinha e preenche rua, bairro,
 * cidade e UF; o foco pula para o numero, que e o unico dado que o ViaCEP nao
 * tem como saber. Os campos continuam editaveis — condominio, zona rural e CEP
 * novo nem sempre estao na base.
 *
 * Usa `name` nos inputs, entao o formulario que envolve o bloco continua lendo
 * tudo por FormData, sem precisar conhecer este estado.
 */
export function BlocoEndereco({
  inicial,
  titulo = "Endereço",
}: {
  inicial?: ValoresEndereco;
  titulo?: string;
}) {
  const numeroRef = useRef<HTMLInputElement>(null);

  const [cep, setCep] = useState(formatarCep(inicial?.cep ?? ""));
  const [endereco, setEndereco] = useState(inicial?.endereco ?? "");
  const [bairro, setBairro] = useState(inicial?.bairro ?? "");
  const [cidade, setCidade] = useState(inicial?.cidade ?? "");
  const [uf, setUf] = useState(inicial?.uf ?? "");

  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [achou, setAchou] = useState(false);

  async function consultar(valor: string) {
    setBuscando(true);
    setAviso(null);
    setAchou(false);

    const r = await buscarCep(valor);
    setBuscando(false);

    if (!r.ok) {
      setAviso(r.erro);
      return;
    }

    // Nao sobrescreve o que ja foi digitado a mao sem necessidade
    setEndereco(r.endereco.logradouro || endereco);
    setBairro(r.endereco.bairro || bairro);
    setCidade(r.endereco.cidade || cidade);
    setUf(r.endereco.uf || uf);
    setAchou(true);
    numeroRef.current?.focus();
  }

  function aoDigitarCep(valor: string) {
    const formatado = formatarCep(valor);
    setCep(formatado);
    setAchou(false);
    setAviso(null);
    // Dispara sozinho ao completar: ninguem precisa clicar em nada
    if (cepCompleto(formatado)) void consultar(formatado);
  }

  return (
    <fieldset className="grid gap-4 border-t border-carvao-200 pt-5 sm:grid-cols-6">
      <legend className="sr-only">{titulo}</legend>

      <div className="sm:col-span-2">
        <Campo
          rotulo="CEP"
          name="cep"
          value={cep}
          inputMode="numeric"
          maxLength={9}
          placeholder="00000-000"
          onChange={(e) => aoDigitarCep(e.target.value)}
          onBlur={() => { if (cepCompleto(cep) && !achou && !aviso) void consultar(cep); }}
        />
        <p className="mt-1 flex items-center gap-1.5 text-xs">
          {buscando ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-carvao-400" aria-hidden />
              <span className="text-carvao-500">Buscando endereço...</span>
            </>
          ) : aviso ? (
            <span className="text-marca-600">{aviso}</span>
          ) : achou ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" aria-hidden />
              <span className="text-emerald-700">Endereço preenchido</span>
            </>
          ) : (
            <>
              <MapPin className="h-3 w-3 text-carvao-400" aria-hidden />
              <span className="text-carvao-500">Digite o CEP e o resto se preenche</span>
            </>
          )}
        </p>
      </div>

      <Campo rotulo="Endereço" name="endereco" className="sm:col-span-3"
        value={endereco} onChange={(e) => setEndereco(e.target.value)} />
      <Campo rotulo="Nº" name="numero" ref={numeroRef}
        defaultValue={inicial?.numero ?? ""} />
      <Campo rotulo="Bairro" name="bairro" className="sm:col-span-2"
        value={bairro} onChange={(e) => setBairro(e.target.value)} />
      <Campo rotulo="Cidade" name="cidade" className="sm:col-span-3"
        value={cidade} onChange={(e) => setCidade(e.target.value)} />
      <Campo rotulo="UF" name="uf" maxLength={2}
        value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
    </fieldset>
  );
}
