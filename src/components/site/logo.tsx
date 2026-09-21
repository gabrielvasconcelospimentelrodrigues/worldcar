export function Logo({
  tamanho = "md",
  invertido = false,
}: {
  tamanho?: "sm" | "md" | "lg";
  invertido?: boolean;
}) {
  const escala = {
    sm: { caixa: "h-8 w-8 text-base", nome: "text-lg", sub: "text-[9px]" },
    md: { caixa: "h-11 w-11 text-xl", nome: "text-2xl", sub: "text-[10px]" },
    lg: { caixa: "h-16 w-16 text-3xl", nome: "text-4xl", sub: "text-xs" },
  }[tamanho];

  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className={`${escala.caixa} grid place-items-center rounded-lg bg-marca-500 font-display font-extrabold text-white shadow-lg shadow-marca-500/25`}
      >
        W
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={`${escala.nome} font-display font-extrabold uppercase tracking-tight ${
            invertido ? "text-white" : "text-carvao-950"
          }`}
        >
          World<span className="text-marca-500">Car</span>
        </span>
        <span
          className={`${escala.sub} font-semibold uppercase tracking-[0.3em] ${
            invertido ? "text-carvao-400" : "text-carvao-500"
          }`}
        >
          Service
        </span>
      </span>
    </span>
  );
}
