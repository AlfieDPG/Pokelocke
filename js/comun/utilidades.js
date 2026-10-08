export function quitarAcentos(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// "Heavy-Duty Boots" -> "heavydutyboots": para comparar nombres sin fijarse en símbolos
export function normalizarNombre(texto) {
  return quitarAcentos(texto).replace(/[^a-z0-9]/g, "");
}

export function copiaProfunda(objeto) {
  return JSON.parse(JSON.stringify(objeto));
}

// Para meter texto escrito por una persona dentro de una plantilla HTML sin que
// unos <> o unas comillas rompan la página (o metan código de otro).
export function escaparHTML(texto) {
  return String(texto == null ? "" : texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
