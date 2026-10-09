// Ventana para crear o cambiar un juego propio (lo usan «Rutas» y «Level caps»).
//
//   · Rutas: una caja de texto, un lugar por línea. Una línea que empieza por «#» abre un
//     apartado nuevo con ese título («# Ciudades»).
//   · Level caps: una fila por combate (combate, rival, lugar y nivel).
//   · Al crear, se puede empezar desde uno de la web: se copian sus lugares y sus combates
//     para retocarlos.
//
// Los datos están en js/comun/juegos-propios.js.

import { escaparHTML } from "./utilidades.js";
import { icono } from "./iconos.js";
import { JUEGOS } from "./juegos.js";
import { LUGARES } from "../rutas/datos.js";
import { COMBATES } from "../levelcaps/datos.js";
import {
  juegoPropio, guardarJuegoPropio, borrarJuegoPropio, nombreLibre, tipoDeCombate
} from "./juegos-propios.js";
import { actualizarJuegoEnMisLockes } from "./lockes.js";

const dialogo = document.querySelector("#dialogo-juego");
const campoNombre = dialogo.querySelector(".juego-nombre");
const campoBase = dialogo.querySelector(".juego-base");
const campoLugares = dialogo.querySelector(".juego-lugares");
const filas = dialogo.querySelector(".juego-combates");
const error = dialogo.querySelector(".juego-error");

let editando = null;    // id del juego que se cambia, o null si es nuevo
let alGuardar = null;   // a quién avisar con el juego guardado (la sección lo abre)

// ---------- De los juegos de la web ----------

const TITULOS = { rutas: "Rutas", ciudades: "Ciudades y pueblos", postgame: "Postgame", eventos: "Pokémon de evento" };

function seccionesDeLaWeb(id) {
  const lugares = LUGARES[id];
  if (!lugares) return [];
  const apartados = lugares.apartados || Object.keys(TITULOS).map((clave) => ({ clave, titulo: TITULOS[clave] }));
  return apartados
    .filter((apartado) => (lugares[apartado.clave] || []).length)
    .map((apartado) => ({ titulo: apartado.titulo, lugares: [...lugares[apartado.clave]] }));
}

// ---------- Texto de los lugares ----------

function textoDeSecciones(secciones) {
  return secciones.map((seccion) => [`# ${seccion.titulo}`, ...seccion.lugares].join("\n")).join("\n");
}

function seccionesDelTexto(texto) {
  const secciones = [];
  let actual = null;
  for (const linea of texto.split("\n").map((cada) => cada.trim()).filter(Boolean)) {
    if (linea.startsWith("#")) {
      actual = { titulo: linea.replace(/^#+\s*/, "") || "Lugares", lugares: [] };
      secciones.push(actual);
    } else {
      if (!actual) {
        actual = { titulo: "Lugares", lugares: [] };
        secciones.push(actual);
      }
      if (!actual.lugares.includes(linea)) actual.lugares.push(linea);
    }
  }
  return secciones;
}

// ---------- Filas de combates ----------

function plantillaFila(combate = {}) {
  const valor = (texto) => escaparHTML(texto || "");
  return `
    <div class="juego-combate" data-tipo="${valor(combate.tipo)}" data-etiqueta="${valor(combate.etiqueta)}"
         data-seccion="${valor(combate.seccion)}">
      <input class="c-etiqueta" type="text" placeholder="Gimnasio 1" value="${valor(combate.etiqueta)}">
      <input class="c-nombre" type="text" placeholder="Brock" value="${valor(combate.nombre)}">
      <input class="c-lugar" type="text" placeholder="Lugar" value="${valor(combate.lugar)}">
      <input class="c-nivel" type="number" min="1" max="100" placeholder="Nv." value="${combate.nivel || ""}">
      <button type="button" class="c-quitar" title="Quitar">${icono("aspa")}</button>
    </div>`;
}

function pintarFilas(combates) {
  filas.innerHTML = combates.map(plantillaFila).join("");
}

function leerFilas() {
  return [...filas.querySelectorAll(".juego-combate")]
    .map((fila) => {
      const etiqueta = fila.querySelector(".c-etiqueta").value.trim();
      const combate = {
        etiqueta,
        nombre: fila.querySelector(".c-nombre").value.trim(),
        lugar: fila.querySelector(".c-lugar").value.trim(),
        nivel: Number(fila.querySelector(".c-nivel").value) || 0,
        // El tipo copiado se respeta mientras no se cambie el nombre del combate
        tipo: fila.dataset.tipo && etiqueta === fila.dataset.etiqueta ? fila.dataset.tipo : tipoDeCombate(etiqueta)
      };
      if (fila.dataset.seccion) combate.seccion = fila.dataset.seccion;
      return combate;
    })
    .filter((combate) => combate.etiqueta || combate.nombre);
}

// ---------- Abrir ----------

// juego: el que se cambia (uno propio); sin él, uno nuevo. listo(juego): al guardar.
export function abrirEditorJuego(id = null, listo = null) {
  const juego = id ? juegoPropio(id) : null;
  editando = juego ? juego.id : null;
  alGuardar = listo;

  dialogo.querySelector(".juego-titulo").textContent = juego ? "Editar juego" : "Nuevo juego";
  dialogo.querySelector(".juego-campo-base").hidden = Boolean(juego);
  dialogo.querySelector(".juego-borrar").hidden = !juego;
  campoBase.innerHTML =
    `<option value="">En blanco</option>` +
    JUEGOS.map((cada) => `<option value="${cada.id}">${escaparHTML(cada.nombre)}</option>`).join("");

  campoNombre.value = juego ? juego.nombre : "";
  campoLugares.value = juego ? textoDeSecciones(juego.secciones || []) : "";
  pintarFilas(juego ? juego.combates || [] : []);
  error.textContent = "";

  dialogo.showModal();
  campoNombre.focus();
}

function copiarDeLaWeb(id) {
  if (!id) {
    campoLugares.value = "";
    pintarFilas([]);
    return;
  }
  campoLugares.value = textoDeSecciones(seccionesDeLaWeb(id));
  pintarFilas((COMBATES[id] || []).map((combate) => ({ ...combate })));
  if (!campoNombre.value.trim()) {
    const base = JUEGOS.find((cada) => cada.id === id);
    campoNombre.value = `${base.nombre} (mío)`.slice(0, 40);
  }
}

function guardar() {
  const nombre = campoNombre.value.trim();
  if (!nombre) {
    error.textContent = "Ponle un nombre.";
    campoNombre.focus();
    return;
  }
  if (!nombreLibre(nombre, editando)) {
    error.textContent = "Ya tienes un juego con ese nombre.";
    return;
  }

  const combates = leerFilas();
  if (combates.some((combate) => !(combate.nivel >= 1 && combate.nivel <= 100))) {
    error.textContent = "A cada combate le falta su nivel (de 1 a 100).";
    return;
  }

  const anterior = editando ? juegoPropio(editando) : null;
  const juego = guardarJuegoPropio({
    id: editando,
    nombre,
    base: anterior ? anterior.base : campoBase.value,
    secciones: seccionesDelTexto(campoLugares.value),
    combates
  });

  // Los lockes que has creado con este juego se ponen al día (y, de ahí, los demás)
  actualizarJuegoEnMisLockes(juego).catch((fallo) => console.error(fallo));

  dialogo.close();
  if (alGuardar) alGuardar(juego);
}

// ---------- Arranque (al cargar el módulo) ----------

campoBase.addEventListener("change", () => copiarDeLaWeb(campoBase.value));

dialogo.querySelector(".juego-anadir-combate").addEventListener("click", () => {
  filas.insertAdjacentHTML("beforeend", plantillaFila());
  filas.lastElementChild.querySelector(".c-etiqueta").focus();
});

filas.addEventListener("click", (e) => {
  const quitar = e.target.closest(".c-quitar");
  if (quitar) quitar.closest(".juego-combate").remove();
});

dialogo.querySelector(".juego-formulario").addEventListener("submit", (e) => {
  e.preventDefault();
  guardar();
});

dialogo.querySelector(".juego-cancelar").addEventListener("click", () => dialogo.close());

dialogo.querySelector(".juego-borrar").addEventListener("click", () => {
  const juego = editando ? juegoPropio(editando) : null;
  if (!juego || !confirm(`¿Borrar «${juego.nombre}»? Se pierden sus rutas y sus level caps.\n\nLos lockes que lo usan lo conservan.`)) return;
  borrarJuegoPropio(juego.id);
  dialogo.close();
});
