"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Rotulo } from "./index";

/**
 * Campo de assinatura em canvas. Funciona com dedo (tablet/celular),
 * caneta e mouse. O traço é gravado num input hidden como data URL PNG,
 * então o formulário que envolve o componente envia normalmente.
 */
export function CampoAssinatura({
  name,
  rotulo = "Assinatura do cliente",
  dica,
  valorInicial,
  obrigatorio,
}: {
  name: string;
  rotulo?: string;
  dica?: string;
  valorInicial?: string | null;
  obrigatorio?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(Boolean(valorInicial));
  const [valor, setValor] = useState(valorInicial ?? "");

  /** O canvas é dimensionado em pixels de dispositivo para não sair serrilhado. */
  const preparar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const proporcao = window.devicePixelRatio || 1;
    const caixa = canvas.getBoundingClientRect();
    if (caixa.width === 0) return;

    // Preserva o que já estava desenhado ao redimensionar.
    const anterior = temTraco ? canvas.toDataURL("image/png") : null;

    canvas.width = Math.round(caixa.width * proporcao);
    canvas.height = Math.round(caixa.height * proporcao);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(proporcao, proporcao);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#17171d";

    if (anterior) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, caixa.width, caixa.height);
      img.src = anterior;
    }
  }, [temTraco]);

  useEffect(() => {
    preparar();
    const aoRedimensionar = () => preparar();
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
    // Só na montagem: `preparar` muda de identidade a cada traço novo e
    // não queremos reconstruir o canvas no meio de uma assinatura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function posicao(e: React.PointerEvent<HTMLCanvasElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caixa.left, y: e.clientY - caixa.top };
  }

  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const { x, y } = posicao(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicao(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!temTraco) setTemTraco(true);
  }

  function terminar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    desenhando.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const canvas = canvasRef.current;
    if (canvas) setValor(canvas.toDataURL("image/png"));
  }

  function limpar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
    setValor("");
  }

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <Rotulo obrigatorio={obrigatorio}>{rotulo}</Rotulo>
        {temTraco && (
          <button
            type="button"
            onClick={limpar}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-carvao-500 transition hover:text-marca-600"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            Limpar
          </button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-md border border-carvao-300 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={comecar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          onPointerCancel={terminar}
          role="img"
          aria-label={rotulo}
          className="block h-40 w-full cursor-crosshair touch-none"
        />
        {!temTraco && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
            <div className="h-px w-2/3 bg-carvao-200" />
            <p className="text-xs text-carvao-400">Assine aqui com o dedo ou o mouse</p>
          </div>
        )}
      </div>

      <input type="hidden" name={name} value={valor} />
      {dica && <p className="mt-1 text-xs text-carvao-500">{dica}</p>}
    </div>
  );
}
