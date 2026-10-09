import { REGIONES, JUEGOS } from "./juegos.js";
import { leer, escribir } from "./almacen.js";

// Pestañas de región y, debajo, los juegos de esa región (solo salen las regiones con juegos).
// Recuerda la última elección en claveGuardado.
// Llama a alElegir(juego) al empezar y cada vez que cambia el juego.
//
// Devuelve { elegirPorId }: para abrir la sección ya en un juego concreto desde fuera (los
// botones de Rutas y Level caps de un locke en «Versus»).
export function crearSelectorJuego(contenedor, claveGuardado, alElegir) {
  const regiones = REGIONES.filter((r) => JUEGOS.some((j) => j.region === r.id));
  let actual = JUEGOS.find((j) => j.id === leer(claveGuardado, null)) || JUEGOS[0];

  function pintar() {
    const deLaRegion = JUEGOS.filter((j) => j.region === actual.region);

    contenedor.innerHTML = `
      <div class="selector-regiones">
        ${regiones
          .map((r) => `<button data-region="${r.id}" class="${r.id === actual.region ? "activa" : ""}">${r.nombre}</button>`)
          .join("")}
      </div>
      <div class="selector-juegos">
        ${deLaRegion
          .map((j) => `<button data-juego="${j.id}" class="${j.id === actual.id ? "activo" : ""}">${j.nombre}</button>`)
          .join("")}
      </div>
    `;
  }

  function elegir(juego) {
    if (!juego || juego === actual) return;
    actual = juego;
    escribir(claveGuardado, juego.id);
    pintar();
    alElegir(juego);
  }

  // Un solo oyente para todos los botones
  contenedor.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.dataset.region) elegir(JUEGOS.find((j) => j.region === boton.dataset.region));
    if (boton.dataset.juego) elegir(JUEGOS.find((j) => j.id === boton.dataset.juego));
  });

  pintar();
  alElegir(actual);

  return {
    elegirPorId(id) {
      elegir(JUEGOS.find((j) => j.id === id));
    }
  };
}

// Para saltar a Rutas o Level caps en un juego: se deja apuntado y la sección lo lee al
// abrirse (mostrar). Así funciona tanto si la sección ya estaba cargada como si no.
export const CLAVES_JUEGO = {
  rutas: "poketeams-rutas-juego-v1",
  levelcaps: "poketeams-levelcaps-juego-v1"
};

export function juegoPorId(id) {
  return JUEGOS.find((j) => j.id === id) || null;
}
