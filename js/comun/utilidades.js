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
