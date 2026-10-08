// Sección «Level caps»: combates importantes de cada juego con el nivel máximo permitido.
// Los combates de cada juego están en ./datos.js

import { COMBATES } from "./datos.js";
import { crearSelectorJuego } from "../comun/selector-juego.js";
import { leer, escribir } from "../comun/almacen.js";

// NO cambiar estas claves: si se cambian, se pierden los combates marcados como superados
const CLAVE_SUPERADOS = "poketeams-levelcaps-v2"; // { idJuego: [claveCombate, ...] }
const CLAVE_JUEGO = "poketeams-levelcaps-juego-v1";
const CLAVE_MULTIPLICADOR = "poketeams-levelcaps-multiplicador-v1"; // { idJuego: 1.5, ... }

// Multiplicador de nivel (randomizers que suben el nivel de los entrenadores)
const MULTIPLICADOR_MIN = 0.5;
const MULTIPLICADOR_MAX = 3;
const MULTIPLICADOR_PASO = 0.1;

const vista = document.getElementById("vista-levelcaps");
const selector = vista.querySelector(".selector-juego");
const resumen = vista.querySelector(".caps-actual");
const lista = vista.querySelector(".caps-lista");
const valorMultiplicador = vista.querySelector(".multiplicador-valor");

let juego = null;
let combates = [];
let superados = new Set();
let multiplicador = 1;
const guardados = leer(CLAVE_SUPERADOS, {});
const multiplicadores = leer(CLAVE_MULTIPLICADOR, {});

// Identifica el combate aunque se añadan otros a la lista más adelante.
// Incluye el lugar porque hay rivales que se repiten (Azul en la Ruta 22, en Ciudad Celeste...).
function claveCombate(c) {
  return `${c.etiqueta}|${c.nombre}|${c.lugar || ""}`;
}

// Nivel con el multiplicador aplicado (redondeado y como mucho 100)
function nivel(c) {
  return Math.min(100, Math.round(c.nivel * multiplicador));
}

function textoNivel(c) {
  return c.aprox ? `≈${nivel(c)}` : String(nivel(c));
}

function tituloNivel(c) {
  const partes = [];
  if (multiplicador !== 1) partes.push(`Nivel original: ${c.nivel}`);
  if (c.aprox) partes.push("Nivel aproximado, sin verificar del todo");
  return partes.length ? `title="${partes.join(". ")}"` : "";
}

function pintarMultiplicador() {
  valorMultiplicador.textContent = `×${multiplicador.toFixed(1)}`;
}

function cambiarMultiplicador(paso) {
  // Se redondea a un decimal para que no se acumulen errores (1.1 + 0.1 = 1.2000000000000002)
  const nuevo = Math.round((multiplicador + paso) * 10) / 10;
  multiplicador = Math.min(MULTIPLICADOR_MAX, Math.max(MULTIPLICADOR_MIN, nuevo));
  multiplicadores[juego.id] = multiplicador;
  escribir(CLAVE_MULTIPLICADOR, multiplicadores);
  pintarMultiplicador();
  pintarLista();
}

function pintarResumen() {
  // Los combates de secciones aparte (p. ej. líderes de otras regiones) no cuentan
  const siguiente = combates.find((c) => !c.seccion && !superados.has(claveCombate(c)));

  if (!siguiente) {
    resumen.innerHTML = "¡Has superado todos los combates de este juego!";
    return;
  }
  resumen.innerHTML = `
    <span>Tu level cap ahora:</span>
    <strong class="caps-nivel-grande">${textoNivel(siguiente)}</strong>
    <span>antes de ${siguiente.etiqueta.toLowerCase()} · ${siguiente.nombre}</span>
  `;
}

function filaCombate(c) {
  const clave = claveCombate(c);
  const hecho = superados.has(clave);
  return `
    <li class="cap ${c.tipo} ${hecho ? "superado" : ""}">
      <label>
        <input type="checkbox" data-clave="${clave}" ${hecho ? "checked" : ""}>
        <span class="cap-etiqueta">${c.etiqueta}</span>
        <span class="cap-nombre">${c.nombre}</span>
        ${c.lugar ? `<span class="cap-lugar">${c.lugar}</span>` : ""}
      </label>
      <span class="cap-nivel" ${tituloNivel(c)}>Nv. ${textoNivel(c)}</span>
    </li>`;
}

function pintarLista() {
  // Primero los combates normales y después, con su título, los de cada sección aparte
  let html = combates.filter((c) => !c.seccion).map(filaCombate).join("");

  const secciones = [...new Set(combates.filter((c) => c.seccion).map((c) => c.seccion))];
  for (const seccion of secciones) {
    html += `<li class="caps-seccion"><h3>${seccion}</h3></li>`;
    html += combates.filter((c) => c.seccion === seccion).map(filaCombate).join("");
  }

  lista.innerHTML = html;
  pintarResumen();
}

export function iniciar() {
  // Un solo oyente para todas las casillas
  lista.addEventListener("change", (e) => {
    const casilla = e.target.closest("input[data-clave]");
    if (!casilla) return;
    if (casilla.checked) superados.add(casilla.dataset.clave);
    else superados.delete(casilla.dataset.clave);
    casilla.closest(".cap").classList.toggle("superado", casilla.checked);

    guardados[juego.id] = [...superados];
    escribir(CLAVE_SUPERADOS, guardados);
    pintarResumen();
  });

  vista.querySelector(".caps-reiniciar").addEventListener("click", () => {
    if (superados.size === 0) return;
    if (!confirm(`¿Desmarcar todos los combates de ${juego.nombre}?`)) return;
    superados.clear();
    guardados[juego.id] = [];
    escribir(CLAVE_SUPERADOS, guardados);
    pintarLista();
  });

  vista.querySelector(".multiplicador-menos").addEventListener("click", () => cambiarMultiplicador(-MULTIPLICADOR_PASO));
  vista.querySelector(".multiplicador-mas").addEventListener("click", () => cambiarMultiplicador(MULTIPLICADOR_PASO));

  crearSelectorJuego(selector, CLAVE_JUEGO, elegirJuego);
}

function elegirJuego(nuevo) {
  juego = nuevo;
  combates = COMBATES[juego.id];
  superados = new Set(guardados[juego.id] || []);
  multiplicador = multiplicadores[juego.id] || 1;
  pintarMultiplicador();
  pintarLista();
}

export function mostrar() {
  // nada que actualizar: la vista se mantiene como se dejó
}
