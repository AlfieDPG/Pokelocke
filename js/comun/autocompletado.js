import { quitarAcentos } from "./utilidades.js";

// ---------- Desplegable de sugerencias ----------

export function activarAutocompletado(campo, lista, alElegir) {
  const caja = document.createElement("div");
  caja.className = "sugerencias";
  campo.parentElement.appendChild(caja);
  let actuales = [];

  function limpiar() {
    caja.innerHTML = "";
    actuales = [];
  }

  function elegir(entrada) {
    limpiar();
    alElegir(entrada);
  }

  function mostrar() {
    limpiar();
    const texto = quitarAcentos(campo.value.trim());
    if (!texto) return;

    actuales = lista
      .filter((e) => e.buscar.includes(texto))
      .sort((a, b) => Number(b.buscar.startsWith(texto)) - Number(a.buscar.startsWith(texto)))
      .slice(0, 8);

    for (const entrada of actuales) {
      const opcion = document.createElement("div");
      opcion.className = "opcion";
      opcion.textContent = entrada.es === entrada.en ? entrada.es : `${entrada.es} (${entrada.en})`;
      opcion.addEventListener("mousedown", (e) => {
        e.preventDefault();
        elegir(entrada);
      });
      caja.appendChild(opcion);
    }
  }

  campo.addEventListener("input", mostrar);
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && actuales.length) elegir(actuales[0]);
  });
  campo.addEventListener("blur", limpiar);

  return {
    elegirPrimera: () => {
      mostrar();
      if (actuales.length) elegir(actuales[0]);
    }
  };
}
