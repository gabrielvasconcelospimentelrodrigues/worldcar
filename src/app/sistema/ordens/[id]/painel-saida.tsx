"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { StatusOS } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Cartao,
  CabecalhoCartao,
  Selecao,
} from "@/components/ui";
import { CampoAssinatura } from "@/components/ui/assinatura";
import { FORMA_PAGAMENTO, STATUS_OS } from "@/lib/constantes";
import { brl } from "@/lib/format";
import { mudarStatusOrdemAction, registrarSaidaAction, type Estado } from "../actions";

type Funcionario = { id: string; nome: string; cargo: string };

function BotaoEntregar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending} className="px-6 py-2.5">
      {pending ? "Registrando..." : "Confirmar entrega do veículo"}
    </Botao>
  );
}

export function PainelSaida({
  ordemId,
  status,
  total,
  clienteNome,
  kmEntrada,
  funcionarios,
  transicoes,
  temVistoriaSaida,
  pendencias,
}: {
  ordemId: string;
  status: StatusOS;
  total: number;
  clienteNome: string;
  kmEntrada: number | null;
  funcionarios: Funcionario[];
  transicoes: StatusOS[];
  temVistoriaSaida: boolean;
  pendencias: number;
}) {
  const [estado, acao] = useActionState<Estado, FormData>(registrarSaidaAction, {});
  const [aberto, setAberto] = useState(false);

  const bloqueado = pendencias > 0 || !temVistoriaSaida;

  return (
    <Cartao>
      <CabecalhoCartao
        titulo="Andamento e saída"
        descricao={`Situação atual: ${STATUS_OS[status].label}`}
      />

      <div className="space-y-4 p-5">
        {/* Transicoes simples de status */}
        {transicoes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {transicoes
              .filter((t) => t !== "ENTREGUE")
              .map((t) => (
                <form key={t} action={mudarStatusOrdemAction}>
                  <input type="hidden" name="id" value={ordemId} />
                  <input type="hidden" name="status" value={t} />
                  <Botao
                    type="submit"
                    variante={t === "CANCELADA" ? "perigo" : "fantasma"}
                  >
                    {t === "CANCELADA" ? "Cancelar OS" : `Marcar: ${STATUS_OS[t].label}`}
                  </Botao>
                </form>
              ))}
          </div>
        )}

        {status === "ENTREGUE" ? (
          <Aviso tipo="sucesso">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Serviço finalizado e veículo entregue. Os alertas de retorno de garantia e
              de pós-venda já foram criados.
            </span>
          </Aviso>
        ) : status === "CANCELADA" ? (
          <Aviso tipo="erro">Esta OS foi cancelada.</Aviso>
        ) : (
          <>
            {bloqueado && (
              <Aviso>
                Para entregar o veículo faltam:
                <ul className="mt-1.5 list-inside list-disc">
                  {pendencias > 0 && (
                    <li>{pendencias} serviço(s) a concluir ou cancelar</li>
                  )}
                  {!temVistoriaSaida && (
                    <li>
                      vistoria de saída —{" "}
                      <Link
                        href={`/sistema/vistorias/nova?ordem=${ordemId}&tipo=SAIDA`}
                        className="font-semibold underline"
                      >
                        registrar agora
                      </Link>
                    </li>
                  )}
                </ul>
              </Aviso>
            )}

            {!aberto ? (
              <Botao
                type="button"
                onClick={() => setAberto(true)}
                disabled={bloqueado}
                className="px-6 py-2.5"
              >
                Registrar saída do veículo
              </Botao>
            ) : (
              <form action={acao} className="space-y-4 rounded-md border border-carvao-300 bg-carvao-50 p-4">
                <input type="hidden" name="id" value={ordemId} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Selecao
                    rotulo="Funcionário que entregou"
                    name="funcionarioSaidaId"
                    dica="Responsável pela saída"
                    required
                  >
                    <option value="">Selecione...</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome} — {f.cargo}
                      </option>
                    ))}
                  </Selecao>
                  <Campo
                    rotulo="KM na saída"
                    name="kmSaida"
                    type="number"
                    min={kmEntrada ?? 0}
                    defaultValue={kmEntrada ?? ""}
                  />
                  <Campo
                    rotulo="Quem retirou o veículo"
                    name="clienteRetirou"
                    defaultValue={clienteNome}
                    required
                  />
                  <Campo
                    rotulo="Documento de quem retirou"
                    name="documentoRetirada"
                    placeholder="RG ou CPF"
                  />
                  <Selecao rotulo="Forma de pagamento" name="formaPagamento">
                    <option value="">Definir depois</option>
                    {Object.entries(FORMA_PAGAMENTO).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Selecao>
                  <Campo
                    rotulo="Parcelas"
                    name="parcelas"
                    type="number"
                    min={1}
                    max={24}
                    defaultValue={1}
                    dica={`Total de ${brl(total)}`}
                  />
                  <AreaTexto
                    rotulo="Observações da saída"
                    name="observacoesSaida"
                    rows={2}
                    className="sm:col-span-2"
                    placeholder="Orientações dadas ao cliente, itens devolvidos..."
                  />
                  <div className="sm:col-span-2">
                    <CampoAssinatura
                      name="assinaturaEntrega"
                      rotulo="Assinatura de recebimento do veículo"
                      dica="Peça ao cliente para assinar na tela. Fica gravada na OS e sai no PDF."
                    />
                  </div>
                </div>

                {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

                <div className="flex flex-wrap gap-2">
                  <BotaoEntregar />
                  <Botao type="button" variante="fantasma" onClick={() => setAberto(false)}>
                    Cancelar
                  </Botao>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </Cartao>
  );
}
