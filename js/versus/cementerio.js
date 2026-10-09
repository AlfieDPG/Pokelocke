// Cementerio de un locke y la ventana de apuntar un muerto.
//
//   · Cementerio: una columna por jugador (la tuya primero), con sus muertos como lápidas con
//     el retrato de Mundo Misterioso. En la tuya, una lápida «+» para apuntar uno y una X en
//     cada uno para quitarlo si te equivocaste.
//   · Apuntar un muerto: Pokémon, mote y contra quién. Sale también al darle a «−» en tus
//     vidas: ahí el Pokémon es opcional (se puede perder una vida sin decir quién).
//
// Los datos están en js/comun/lockes.js (Cementerio).

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { usuarioActual } from "../comun/nube.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { activarAutocompletado } from "../comun/autocompletado.js";
import { imagenConRespaldo, urlsPMD, urlSpritePixel } from "../comun/imagenes.js";
import { lockePorId, estadoDe, muertosDe, apuntarMuerto, borrarMuerto, cambiarNumero, alCambiarLockes } from "../comun/lockes.js";

let dialogoCementerio = null;
let dialogoMuerte = null;
let idCementerio = null; // locke del cementerio abierto

let idMuerte = null;     // locke en el que se apunta el muerto
let desdeVidas = false;  // se abrió con el «−» de las vidas
let elegido = null;      // Pokémon elegido en el buscador: { id, es }
let listaPokemon = [];   // la que mira el autocompletado (se rellena al cargar los datos)
let autocompletado = null;

// Retrato de Mundo Misterioso de una especie; si no lo hay, el sprite pequeño
export function retratoEspecie(especie, clase = "") {
  return imagenConRespaldo(
    [...urlsPMD({ id: especie }), urlSpritePixel(especie)],
    `class="${clase}" alt="" loading="lazy" data-quitar-si-falla`
  );
}

export function nombreMuerto(muerto) {
  return muerto.mote ? `${muerto.nombre} «${muerto.mote}»` : muerto.nombre;
}

// ---------- Cementerio ----------

export function totalMuertos(locke) {
  return Object.values((locke && locke.muertos) || {}).reduce((total, lista) => total + lista.length, 0);
}

function plantillaTumba(muerto, mia) {
  const fecha = muerto.fecha
    ? new Date(muerto.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
    : "";
  const detalle = [muerto.causa && `Contra ${muerto.causa}`, fecha].filter(Boolean).join(" · ");
  return `
    <div class="tumba" title="${escaparHTML(detalle)}">
      ${retratoEspecie(muerto.especie, "tumba-cara")}
      <span class="tumba-mote">${escaparHTML(muerto.mote || muerto.nombre)}</span>
      ${muerto.mote ? `<span class="tumba-especie">${escaparHTML(muerto.nombre)}</span>` : ""}
      ${mia ? `<button class="tumba-quitar" data-muerto="${escaparHTML(muerto.id)}" title="Quitar">${icono("aspa")}</button>` : ""}
    </div>`;
}

function plantillaColumna(locke, uid) {
  const usuario = usuarioActual();
  const mia = uid === usuario.uid;
  const muertos = [...muertosDe(locke, uid)].reverse(); // el último, primero
  const nombre = (locke.nombres || {})[uid] || "Jugador";
  const foto = (locke.fotos || {})[uid] || "";
  const abierto = locke.estado !== "cerrado";

  return `
    <section class="cementerio-jugador ${mia ? "mio" : ""}">
      <header>
        <span class="cementerio-cara">${foto ? `<img src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer">` : escaparHTML(nombre[0] || "?")}</span>
        <span class="cementerio-nombre">${escaparHTML(nombre)}</span>
        <span class="cementerio-cuenta">${icono("calavera")} ${muertos.length}</span>
      </header>
      <div class="tumbas">
        ${mia && abierto ? `<button class="tumba tumba-nueva" title="Apuntar un muerto">${icono("mas")}</button>` : ""}
        ${muertos.map((muerto) => plantillaTumba(muerto, mia)).join("")}
        ${!muertos.length && !(mia && abierto) ? `<p class="cementerio-vacio">Ninguno</p>` : ""}
      </div>
    </section>`;
}

function pintarCementerio() {
  const locke = idCementerio ? lockePorId(idCementerio) : null;
  if (!locke) {
    if (dialogoCementerio.open) dialogoCementerio.close();
    return;
  }

  const usuario = usuarioActual();
  const jugadores = locke.jugadores
    .filter((uid) => estadoDe(locke, uid) === "aceptado")
    .sort((uno, otro) => Number(otro === usuario.uid) - Number(uno === usuario.uid));

  dialogoCementerio.querySelector(".cementerio-titulo").innerHTML =
    `${icono("calavera")} Cementerio · ${escaparHTML(locke.nombre)}`;
  dialogoCementerio.querySelector(".cementerio-cuerpo").innerHTML =
    `<div class="cementerio-columnas">${jugadores.map((uid) => plantillaColumna(locke, uid)).join("")}</div>`;
}

export function abrirCementerio(id) {
  idCementerio = id;
  pintarCementerio();
  if (!dialogoCementerio.open) dialogoCementerio.showModal();
}

// ---------- Apuntar un muerto ----------

// desdeLasVidas: con el «−» de las vidas (siempre quita vida y el Pokémon es opcional).
// Si no, desde el cementerio (el Pokémon hace falta y lo de la vida se elige).
export function abrirMuerte(id, desdeLasVidas) {
  const locke = lockePorId(id);
  if (!locke) return;

  idMuerte = id;
  desdeVidas = desdeLasVidas;
  elegido = null;

  dialogoMuerte.querySelector(".muerte-titulo").textContent = desdeLasVidas ? "Perder una vida" : "Apuntar un muerto";
  dialogoMuerte.querySelector(".muerte-ok").textContent = desdeLasVidas ? "Quitar vida" : "Apuntar";
  for (const selector of [".muerte-pokemon", ".muerte-mote", ".muerte-causa"]) {
    dialogoMuerte.querySelector(selector).value = "";
  }
  dialogoMuerte.querySelector(".muerte-error").textContent = "";

  // La casilla de la vida solo desde el cementerio, y solo si el locke tiene vidas
  const casilla = dialogoMuerte.querySelector(".muerte-vida");
  dialogoMuerte.querySelector(".muerte-vida-campo").hidden = desdeLasVidas || locke.vidasIlimitadas;
  casilla.checked = !locke.vidasIlimitadas;

  dialogoMuerte.showModal();
  dialogoMuerte.querySelector(".muerte-pokemon").focus();
  cargarDatos()
    .then(() => (listaPokemon.splice(0, listaPokemon.length, ...datos.pokemon)))
    .catch((error) => console.error(error));
}

async function guardarMuerte() {
  const error = dialogoMuerte.querySelector(".muerte-error");
  const texto = dialogoMuerte.querySelector(".muerte-pokemon").value.trim();

  // Si ha escrito algo sin elegirlo de la lista, se coge la primera sugerencia
  if (texto && (!elegido || elegido.es !== texto)) autocompletado.elegirPrimera();
  if (texto && !elegido) {
    error.textContent = "Elige un Pokémon de la lista.";
    return;
  }
  if (!desdeVidas && !elegido) {
    error.textContent = "¿Qué Pokémon ha muerto?";
    return;
  }

  const id = idMuerte;
  dialogoMuerte.close();

  if (!elegido) {
    await cambiarNumero(id, usuarioActual().uid, "vidas", -1);
    return;
  }

  await apuntarMuerto(
    id,
    {
      especie: elegido.id,
      nombre: elegido.es,
      mote: dialogoMuerte.querySelector(".muerte-mote").value.trim(),
      causa: dialogoMuerte.querySelector(".muerte-causa").value.trim()
    },
    desdeVidas || dialogoMuerte.querySelector(".muerte-vida").checked
  );
}

// ---------- Arranque ----------

// alFallar(error): para que la sección diga que no se ha podido guardar
export function iniciarCementerio(alFallar) {
  dialogoCementerio = document.querySelector("#dialogo-cementerio");
  dialogoMuerte = document.querySelector("#dialogo-muerte");

  dialogoCementerio.querySelector(".cementerio-cerrar").addEventListener("click", () => dialogoCementerio.close());
  dialogoCementerio.addEventListener("close", () => (idCementerio = null));

  dialogoCementerio.querySelector(".cementerio-cuerpo").addEventListener("click", (e) => {
    if (e.target.closest(".tumba-nueva")) {
      abrirMuerte(idCementerio, false);
      return;
    }
    const quitar = e.target.closest(".tumba-quitar");
    if (quitar && confirm("¿Quitar este Pokémon del cementerio?\n\nLa vida no se devuelve: eso se hace con el «+».")) {
      borrarMuerto(idCementerio, quitar.dataset.muerto).catch(alFallar);
    }
  });

  const campo = dialogoMuerte.querySelector(".muerte-pokemon");
  // Enter con sugerencias a la vista elige la primera (lo hace el autocompletado) y se queda
  // en la ventana para poner el mote; no la manda. Tiene que ir antes que el autocompletado,
  // que al elegir vacía las sugerencias.
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && campo.parentElement.querySelector(".sugerencias .opcion")) e.preventDefault();
  });
  autocompletado = activarAutocompletado(campo, listaPokemon, (pokemon) => {
    elegido = pokemon;
    campo.value = pokemon.es;
    dialogoMuerte.querySelector(".muerte-mote").focus();
  });
  campo.addEventListener("input", () => (elegido = null));

  dialogoMuerte.querySelector(".muerte-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    guardarMuerte().catch(alFallar);
  });
  dialogoMuerte.querySelector(".muerte-cancelar").addEventListener("click", () => dialogoMuerte.close());

  // Si alguien apunta un muerto con el cementerio abierto, sale al momento
  alCambiarLockes(() => {
    if (dialogoCementerio.open) pintarCementerio();
  });
}
