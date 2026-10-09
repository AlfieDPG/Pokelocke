import { REGIONES, JUEGOS } from "./juegos.js";
import { leer, escribir } from "./almacen.js";
import { escaparHTML } from "./utilidades.js";
import { juegosPropios, alCambiarJuegosPropios } from "./juegos-propios.js";

// Pestañas de región y, debajo, los juegos de esa región (solo salen las regiones con juegos).
// Al final, «Tus juegos»: los juegos propios (js/comun/juegos-propios.js) y un botón para
// crear otro (alNuevo).
// Recuerda la última elección en claveGuardado.
// Llama a alElegir(juego) al empezar y cada vez que cambia el juego (también si se cambia o
// se borra el juego propio que está abierto).
//
// Devuelve { elegirPorId }: para abrir la sección ya en un juego concreto desde fuera (los
// botones de Rutas y Level caps de un locke en «Versus»).

export const REGION_PROPIOS = "propios";

function todosLosJuegos() {
  return [
    ...JUEGOS,
    ...juegosPropios().map((juego) => ({ ...juego, region: REGION_PROPIOS, propio: true }))
  ];
}

export function crearSelectorJuego(contenedor, claveGuardado, alElegir, alNuevo) {
  const regiones = [
    ...REGIONES.filter((r) => JUEGOS.some((j) => j.region === r.id)),
    { id: REGION_PROPIOS, nombre: "Tus juegos" }
  ];
  let actual = todosLosJuegos().find((j) => j.id === leer(claveGuardado, null)) || JUEGOS[0];
  let region = actual.region;

  function pintar() {
    const deLaRegion = todosLosJuegos().filter((j) => j.region === region);

    contenedor.innerHTML = `
      <div class="selector-regiones">
        ${regiones
          .map((r) => `<button data-region="${r.id}" class="${r.id === region ? "activa" : ""} ${r.id === REGION_PROPIOS ? "region-propios" : ""}">${r.nombre}</button>`)
          .join("")}
      </div>
      <div class="selector-juegos">
        ${deLaRegion
          .map((j) => `<button data-juego="${escaparHTML(j.id)}" class="${j.id === actual.id ? "activo" : ""}">${escaparHTML(j.nombre)}</button>`)
          .join("")}
        ${region === REGION_PROPIOS ? `<button class="juego-nuevo">+ Nuevo juego</button>` : ""}
      </div>
    `;
  }

  function elegir(juego) {
    if (!juego) return;
    region = juego.region;
    if (juego.id === actual.id) {
      pintar();
      return;
    }
    actual = juego;
    escribir(claveGuardado, juego.id);
    pintar();
    alElegir(juego);
  }

  // Un solo oyente para todos los botones
  contenedor.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.classList.contains("juego-nuevo")) {
      if (alNuevo) alNuevo();
      return;
    }
    if (boton.dataset.region) {
      const primero = todosLosJuegos().find((j) => j.region === boton.dataset.region);
      if (primero) elegir(primero);
      else {
        // «Tus juegos» sin ninguno todavía: se abre la pestaña con el botón de crear
        region = boton.dataset.region;
        pintar();
      }
    }
    if (boton.dataset.juego) elegir(todosLosJuegos().find((j) => j.id === boton.dataset.juego));
  });

  // Si cambia el juego propio abierto, se vuelve a pintar; si se borra, al primero
  alCambiarJuegosPropios(() => {
    const ahora = todosLosJuegos().find((j) => j.id === actual.id);
    if (!ahora) {
      actual = JUEGOS[0];
      region = actual.region;
      escribir(claveGuardado, actual.id);
      pintar();
      alElegir(actual);
      return;
    }
    if (ahora.propio) {
      actual = ahora;
      pintar();
      alElegir(actual);
      return;
    }
    pintar();
  });

  pintar();
  alElegir(actual);

  return {
    elegirPorId(id) {
      elegir(todosLosJuegos().find((j) => j.id === id));
    },
    actual: () => actual
  };
}

// Para saltar a Rutas o Level caps en un juego: se deja apuntado y la sección lo lee al
// abrirse (mostrar). Así funciona tanto si la sección ya estaba cargada como si no.
export const CLAVES_JUEGO = {
  rutas: "poketeams-rutas-juego-v1",
  levelcaps: "poketeams-levelcaps-juego-v1"
};

export function juegoPorId(id) {
  return todosLosJuegos().find((j) => j.id === id) || null;
}
