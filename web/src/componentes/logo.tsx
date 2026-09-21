import marcaClara from "@/assets/logo-marca.webp";
import marcaSelo from "@/assets/logo-selo.webp";

/**
 * Marca da World Car Service.
 *
 * Duas versoes do mesmo desenho, e a escolha nao e estetica:
 *
 * - `invertido` (fundo escuro): a marca recortada, sem fundo. Encaixa no menu
 *   lateral e na lateral do login sem deixar a borda do quadrado aparecer.
 *
 * - padrao (fundo claro): a marca dentro do selo preto. As letras "WORLD CAR
 *   SERVICE" sao brancas — em fundo branco elas simplesmente somem e sobra o
 *   contorno do escudo. O selo devolve a marca ao fundo escuro para o qual ela
 *   foi desenhada, que num brasao e o uso natural, nao um remendo.
 *
 * O arquivo de origem e um JPEG 500x500 com fundo quase preto; o recorte e as
 * reducoes sao gerados a partir dele (ver assets/logo-marca.png).
 */
export function Logo({
  tamanho = "md",
  invertido = false,
}: {
  tamanho?: "sm" | "md" | "lg";
  invertido?: boolean;
}) {
  const altura = { sm: "h-9", md: "h-12", lg: "h-16" }[tamanho];

  return (
    <img
      src={invertido ? marcaClara : marcaSelo}
      alt="World Car Service"
      // `w-auto` para a proporcao do brasao nunca ser esticada, e `select-none`
      // porque arrastar o logo sem querer no tablet da oficina e irritante.
      className={`${altura} w-auto select-none`}
      draggable={false}
    />
  );
}
