// Sección «Rutas»: marcar los lugares donde ya se ha hecho la captura del Nuzlocke.
// Los lugares de cada juego están en ./datos.js

import { LUGARES } from "./datos.js";
import { crearSelectorJuego } from "../comun/selector-juego.js";
import { leer, escribir } from "../comun/almacen.js";
import { quitarAcentos } from "../comun/utilidades.js";

// NO cambiar estas claves: si se cambian, se pierden las rutas marcadas
const CLAVE_MARCADAS = "poketeams-rutas-v2"; // { idJuego: ["rutas:Ruta 1", ...] }
const CLAVE_JUEGO = "poketeams-rutas-juego-v1";

// Apartados en el orden en que se muestran. Si un juego no tiene alguno (p. ej. postgame), no sale.
const APARTADOS = [
  { clave: "rutas", titulo: "Rutas" },
  { clave: "ciudades", titulo: "Ciudades y pueblos" },
  { clave: "postgame", titulo: "Postgame" },
  { clave: "eventos", titulo: "Pokémon de evento" }
];

const vista = document.getElementById("vista-rutas");
const selector = vista.querySelector(".selector-juego");
const lista = vista.querySelector(".rutas-lista");
const buscador = vista.querySelector(".rutas-buscar");
const progreso = vista.querySelector(".rutas-progreso");

let juego = null;   // { id, nombre, region }
let lugares = null; // { rutas, ciudades, postgame, eventos } del juego actual
let usadas = new Set();
const marcadas = leer(CLAVE_MARCADAS, {});

function claveLugar(apartado, texto) {
  return `${apartado}:${texto}`;
}

// Apartados del juego actual: los suyos propios (p. ej. islas de Alola) o los normales
function apartadosDelJuego() {
  return (lugares.apartados || APARTADOS).filter((a) => (lugares[a.clave] || []).length > 0);
}

function guardar() {
  marcadas[juego.id] = [...usadas];
  escribir(CLAVE_MARCADAS, marcadas);
}

function pintarProgreso() {
  const total = apartadosDelJuego().reduce((suma, a) => suma + lugares[a.clave].length, 0);
  progreso.textContent = `Usadas: ${usadas.size} / ${total}`;
}

function botonLugar(apartado, texto) {
  const clave = claveLugar(apartado, texto);
  const usada = usadas.has(clave);

  // Eventos: "Lugar: detalle" -> lugar en negrita y detalle debajo
  const corte = apartado === "eventos" ? texto.indexOf(": ") : -1;
  const contenido =
    corte > 0
      ? `<span class="ruta-lugar">${texto.slice(0, corte)}</span><span class="ruta-detalle">${texto.slice(corte + 2)}</span>`
      : texto;

  return `<button class="ruta ${apartado === "eventos" ? "evento" : ""} ${usada ? "usada" : ""}" aria-pressed="${usada}"
    data-clave="${clave}" data-buscar="${quitarAcentos(texto)}">${contenido}</button>`;
}

function pintarLista() {
  lista.innerHTML = apartadosDelJuego()
    .map(
      (a) => `
        <section class="rutas-grupo ${a.clave}">
          <h3>${a.titulo}</h3>
          <div class="rutas-botones ${a.clave}">${lugares[a.clave].map((texto) => botonLugar(a.clave, texto)).join("")}</div>
        </section>`
    )
    .join("");

  filtrar();
  pintarProgreso();
}

// Oculta los lugares que no coinciden con lo escrito en el buscador
function filtrar() {
  const texto = quitarAcentos(buscador.value.trim());

  for (const boton of lista.querySelectorAll(".ruta")) {
    boton.hidden = Boolean(texto) && !boton.dataset.buscar.includes(texto);
  }
  for (const grupo of lista.querySelectorAll(".rutas-grupo")) {
    grupo.hidden = !grupo.querySelector(".ruta:not([hidden])");
  }
}

export function iniciar() {
  // Un solo oyente para todos los botones de lugar
  lista.addEventListener("click", (e) => {
    const boton = e.target.closest(".ruta");
    if (!boton) return;
    const clave = boton.dataset.clave;
    if (usadas.has(clave)) usadas.delete(clave);
    else usadas.add(clave);
    boton.classList.toggle("usada", usadas.has(clave));
    boton.setAttribute("aria-pressed", usadas.has(clave));
    guardar();
    pintarProgreso();
  });

  buscador.addEventListener("input", filtrar);

  vista.querySelector(".rutas-reiniciar").addEventListener("click", () => {
    if (usadas.size === 0) return;
    if (!confirm(`¿Desmarcar todos los lugares de ${juego.nombre}?`)) return;
    usadas.clear();
    guardar();
    pintarLista();
  });

  selectorJuego = crearSelectorJuego(selector, CLAVE_JUEGO, elegirJuego);
}

let selectorJuego = null;

function elegirJuego(nuevo) {
  juego = nuevo;
  lugares = LUGARES[juego.id];

  // Solo cuentan las marcas de lugares que siguen existiendo. Si un lugar ha cambiado de
  // apartado (p. ej. de «rutas» a «postgame»), su marca se conserva.
  const porTexto = new Map();
  for (const a of apartadosDelJuego()) {
    for (const texto of lugares[a.clave]) porTexto.set(texto, claveLugar(a.clave, texto));
  }
  usadas = new Set();
  for (const clave of marcadas[juego.id] || []) {
    const texto = clave.slice(clave.indexOf(":") + 1);
    if (porTexto.has(texto)) usadas.add(porTexto.get(texto));
  }

  buscador.value = "";
  pintarLista();
}

export function mostrar() {
  // Si se ha llegado desde un locke de «Versus», el juego viene apuntado en CLAVE_JUEGO.
  // Si es el mismo que ya había, no hace nada.
  selectorJuego.elegirPorId(leer(CLAVE_JUEGO, null));
}
