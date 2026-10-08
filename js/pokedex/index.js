// Sección «Pokédex»: tabla con las estadísticas base de todos los Pokémon.
//
// Cada columna tiene un botón en su cabecera: la primera vez que se pulsa ordena de
// menor a mayor y, al volver a pulsarlo, de mayor a menor (el nombre, de la A a la Z
// y al revés). Al entrar, la tabla sale ordenada por número de Pokédex.
//
// Para añadir una columna basta con añadirla a COLUMNAS: la cabecera, las celdas y
// la ordenación salen solas.

import { cargarPokedex } from "./datos.js";
import { imagenConRespaldo, urlsPMD, urlSpritePixel } from "../comun/imagenes.js";
import { coloresTipo, tiposEs, iconoTipo } from "../comun/tipos.js";
import { quitarAcentos } from "../comun/utilidades.js";

// "valor" es lo que se usa para ordenar. La columna de la foto no lo tiene, así que no se ordena.
const COLUMNAS = [
  { clave: "numero", titulo: "Nº", clase: "col-numero", valor: (p) => p.numero },
  { clave: "foto", titulo: "", clase: "col-foto" },
  { clave: "nombre", titulo: "Pokémon", clase: "col-nombre", valor: (p) => p.nombre },
  { clave: "tipos", titulo: "", clase: "col-tipos" },
  { clave: "ps", titulo: "PS", clase: "col-dato", valor: (p) => p.bases[0] },
  { clave: "ataque", titulo: "Ataque", clase: "col-dato", valor: (p) => p.bases[1] },
  { clave: "defensa", titulo: "Defensa", clase: "col-dato", valor: (p) => p.bases[2] },
  { clave: "ataque-especial", titulo: "At. Esp.", clase: "col-dato", valor: (p) => p.bases[3] },
  { clave: "defensa-especial", titulo: "Def. Esp.", clase: "col-dato", valor: (p) => p.bases[4] },
  { clave: "velocidad", titulo: "Velocidad", clase: "col-dato", valor: (p) => p.bases[5] },
  { clave: "total", titulo: "Total", clase: "col-dato col-total", valor: (p) => p.total }
];

const vista = document.getElementById("vista-pokedex");
const aviso = vista.querySelector(".pokedex-aviso");
const barra = vista.querySelector(".barra-pokedex");
const campoBuscar = vista.querySelector(".pokedex-buscar");
const selectorTipo = vista.querySelector(".pokedex-tipo");
const cuentaEl = vista.querySelector(".pokedex-cuenta");
const tabla = vista.querySelector(".tabla-pokedex");
const cabecera = tabla.querySelector("thead");
const cuerpo = tabla.querySelector("tbody");

let pokemon = [];               // lista completa, en el orden en que se está mostrando
const filas = new Map();        // clave -> <tr>, para reordenar sin volver a crear las fotos
let ordenActual = "numero";
let descendente = false;

function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.hidden = !texto;
}

// Retrato de Mundo Misterioso, igual que en los equipos: el de la forma concreta si lo hay
// (Mega-Charizard X, Palafin Héroe...) y si no el de la especie. De último recurso, el sprite
// pequeño de esa forma, para los Pokémon que todavía no tengan retrato.
function foto(p) {
  const urls = [...urlsPMD({ id: p.numero, formaPMD: p.forma }), urlSpritePixel(p.clave)];
  return imagenConRespaldo(urls, `class="pokedex-foto" alt="" loading="lazy" data-quitar-si-falla`);
}

function numeroDex(id) {
  return String(id).padStart(4, "0");
}

function chipTipo(tipo) {
  return `<span class="chip-tipo" style="background:${coloresTipo[tipo]}" title="${tiposEs[tipo]}">${iconoTipo(tipo)}</span>`;
}

function filaPokemon(p) {
  return `
    <tr>
      <td class="col-numero">${numeroDex(p.numero)}</td>
      <td class="col-foto">${foto(p)}</td>
      <td class="col-nombre">${p.nombre}</td>
      <td class="col-tipos">${p.tipos.map(chipTipo).join("")}</td>
      ${p.bases.map((base) => `<td class="col-dato">${base}</td>`).join("")}
      <td class="col-dato col-total">${p.total}</td>
    </tr>`;
}

function celdaCabecera(c) {
  if (!c.valor) return `<th class="${c.clase}"></th>`;

  const activa = c.clave === ordenActual;
  const flecha = activa ? (descendente ? "▼" : "▲") : "↕";
  const sentido = activa && descendente ? "de mayor a menor" : "de menor a mayor";

  return `
    <th class="${c.clase} ${activa ? "ordenada" : ""}">
      <button data-orden="${c.clave}" title="Ordenar ${sentido}">
        ${c.titulo}<span class="flecha">${flecha}</span>
      </button>
    </th>`;
}

function pintarCabecera() {
  cabecera.innerHTML = `<tr>${COLUMNAS.map(celdaCabecera).join("")}</tr>`;
}

// Mueve las filas que ya existen al orden actual: así las fotos no se vuelven a cargar
function pintarFilas() {
  const fragmento = document.createDocumentFragment();
  for (const p of pokemon) fragmento.append(filas.get(p.clave));
  cuerpo.append(fragmento);
}

function comparar(columna) {
  return (a, b) => {
    const valorA = columna.valor(a);
    const valorB = columna.valor(b);
    const diferencia =
      typeof valorA === "string" ? valorA.localeCompare(valorB, "es") : valorA - valorB;

    // Los empates (dos Pokémon con el mismo ataque) se deshacen por el id de PokeAPI, que
    // deja cada especie seguida de sus formas aunque se esté ordenando al revés
    return (descendente ? -diferencia : diferencia) || a.clave - b.clave;
  };
}

function ordenarPor(clave) {
  const columna = COLUMNAS.find((c) => c.clave === clave);
  if (!columna) return;

  // La misma columna otra vez le da la vuelta; una columna nueva empieza de menor a mayor
  if (clave === ordenActual) descendente = !descendente;
  else {
    ordenActual = clave;
    descendente = false;
  }

  pokemon.sort(comparar(columna));
  pintarCabecera();
  pintarFilas();

  // La cabecera se vuelve a crear entera, así que hay que devolver el foco al botón
  // que se acaba de pulsar (si no, no se puede seguir ordenando con el teclado)
  cabecera.querySelector(`[data-orden="${clave}"]`).focus();
}

// ---------- Buscador y filtros ----------

let textoBuscado = "";
let tipoElegido = "";

function pasaFiltros(p) {
  if (tipoElegido && !p.tipos.includes(tipoElegido)) return false;
  return !textoBuscado || p.busqueda.includes(textoBuscado);
}

// Se esconden filas en vez de volver a pintarlas: así no se recargan las fotos
function aplicarFiltros() {
  let visibles = 0;

  for (const p of pokemon) {
    const pasa = pasaFiltros(p);
    filas.get(p.clave).hidden = !pasa;
    if (pasa) visibles++;
  }

  cuentaEl.textContent =
    visibles === pokemon.length ? `${visibles} Pokémon` : `${visibles} de ${pokemon.length}`;
  tabla.hidden = visibles === 0;
  mostrarAviso(visibles === 0 ? "Ningún Pokémon coincide con la búsqueda." : "");
}

function prepararFiltros() {
  for (const tipo of Object.keys(tiposEs)) {
    const opcion = document.createElement("option");
    opcion.value = tipo;
    opcion.textContent = tiposEs[tipo];
    selectorTipo.appendChild(opcion);
  }

  campoBuscar.addEventListener("input", () => {
    textoBuscado = quitarAcentos(campoBuscar.value.trim());
    aplicarFiltros();
  });

  selectorTipo.addEventListener("change", () => {
    tipoElegido = selectorTipo.value;
    aplicarFiltros();
  });
}

export async function iniciar() {
  mostrarAviso("Cargando la Pokédex (solo tarda la primera vez)...");

  try {
    pokemon = await cargarPokedex();
  } catch (error) {
    mostrarAviso("No he podido cargar la Pokédex. Revisa tu conexión y recarga la página.");
    throw error;
  }

  // Texto por el que se busca: nombre sin acentos y número, para poder buscar "25" o "pikachu"
  for (const p of pokemon) p.busqueda = `${quitarAcentos(p.nombre)} ${p.numero}`;

  cuerpo.innerHTML = pokemon.map(filaPokemon).join("");
  [...cuerpo.children].forEach((fila, i) => filas.set(pokemon[i].clave, fila));

  pintarCabecera();
  prepararFiltros();
  aplicarFiltros();
  mostrarAviso("");
  barra.hidden = false;
  tabla.hidden = false;

  // Un solo oyente para los botones de todas las columnas
  cabecera.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-orden]");
    if (boton) ordenarPor(boton.dataset.orden);
  });
}

export function mostrar() {
  // la tabla se mantiene como se dejó (con el orden que eligiera el usuario)
}
