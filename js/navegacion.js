// ---------- Secciones y vistas ----------
//
// Para añadir una sección nueva:
//   1) Crea js/<seccion>/index.js con dos funciones exportadas:
//        iniciar()       -> se ejecuta una sola vez, la primera vez que se abre
//        mostrar(vista)  -> se ejecuta cada vez que se abre una de sus vistas
//   2) Añádela a SECCIONES y sus vistas a VISTAS.
//   3) En index.html: un <section id="vista-XXX" hidden> y un botón data-vista="XXX" en el menú.
//
// El código de cada sección solo se descarga cuando se abre por primera vez,
// así que añadir secciones no hace más lenta la carga inicial.

const SECCIONES = {
  equipos: () => import("./equipos/index.js"),
  rutas: () => import("./rutas/index.js"),
  levelcaps: () => import("./levelcaps/index.js"),
  normas: () => import("./normas/index.js")
};

// Vista -> sección que la gestiona
const VISTAS = {
  crear: "equipos",
  equipos: "equipos",
  rutas: "rutas",
  levelcaps: "levelcaps",
  normas: "normas"
};

const iniciadas = new Map(); // sección -> promesa con su módulo ya iniciado

function cargarSeccion(nombre) {
  if (!iniciadas.has(nombre)) {
    const promesa = SECCIONES[nombre]().then(async (modulo) => {
      await modulo.iniciar();
      return modulo;
    });
    promesa.catch(() => iniciadas.delete(nombre)); // si falla, se reintenta al volver a entrar
    iniciadas.set(nombre, promesa);
  }
  return iniciadas.get(nombre);
}

export async function irA(vista) {
  for (const seccion of document.querySelectorAll("main > section")) {
    seccion.hidden = seccion.id !== `vista-${vista}`;
  }
  for (const boton of document.querySelectorAll(".menu-lateral [data-vista]")) {
    boton.classList.toggle("activa", boton.dataset.vista === vista);
  }

  try {
    const modulo = await cargarSeccion(VISTAS[vista]);
    modulo.mostrar(vista);
  } catch (error) {
    console.error(error); // la propia sección ya muestra el mensaje de error
  }
}

// Un solo oyente para todos los botones del menú
export function iniciarNavegacion() {
  document.querySelector(".menu-lateral").addEventListener("click", (e) => {
    const boton = e.target.closest("[data-vista]");
    if (boton) irA(boton.dataset.vista);
  });
}
