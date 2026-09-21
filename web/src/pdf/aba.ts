/**
 * Reserva da aba onde o PDF sera exibido.
 *
 * Vive em modulo separado de proposito. Precisa ser importado estaticamente,
 * porque roda dentro do clique; e `gerar.ts` carrega o @react-pdf/renderer, um
 * pedaco de 1,2 MB que so deve descer quando alguem pede um documento. Importar
 * daqui mantem essa separacao.
 */

/**
 * Abre a aba ANTES de gerar o PDF, ainda dentro do clique.
 *
 * Montar o documento leva de um a tres segundos. Passado esse tempo o navegador
 * ja nao trata a acao como vinda do usuario e bloqueia o `window.open` em
 * silencio — sem erro, sem aviso, o botao simplesmente nao fazia nada. Abrindo
 * a aba enquanto o clique ainda vale, depois so trocamos o endereco dela.
 *
 * Devolve null quando o bloqueador de pop-up barra mesmo assim; nesse caso
 * `gerar.ts` baixa o arquivo, que nunca e bloqueado.
 */
export function reservarAba(): Window | null {
  const aba = window.open("", "_blank");
  if (!aba) return null;
  aba.document.write(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      "<title>Gerando documento...</title></head>" +
      '<body style="font:16px system-ui;display:grid;place-items:center;' +
      'height:100vh;margin:0;color:#444"><p>Gerando o documento...</p></body></html>',
  );
  aba.document.close();
  return aba;
}
