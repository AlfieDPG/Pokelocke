// Sección «Jugadores»: una ficha fija por jugador con sus lockes ganados.
// Contenido fijo e igual para todo el mundo: para añadir un jugador o un locke
// basta con editar JUGADORES (el orden de la lista es el orden en que se muestran).
//
// Tipos de locke (ver TIPOS): "locke" (azul), "mega" (amarillo) y "bebe" (rosa).
// La foto se busca en img/jugadores/<archivo> probando varias extensiones;
// si no hay ninguna, se muestra la inicial del nombre.

import { imagenConRespaldo } from "../comun/imagenes.js";

const TIPOS = {
  locke: { singular: "Locke", plural: "Lockes" },
  mega: { singular: "Megalocke", plural: "Megalockes" },
  bebe: { singular: "Bebelocke", plural: "Bebelockes" }
};

const JUGADORES = [
  {
    nombre: "Alfie",
    foto: "alfie",
    lockes: [
      { nombre: "Pokémon Ultrasol", tipo: "locke" },
      { nombre: "Pokémon Oro HeartGold", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Pokémon Rubí Omega", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Pokémon Platino", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Pokémon Y", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Megalocke 2025", tipo: "mega" },
      { nombre: "Pokémon Añil 2", tipo: "locke" },
      { nombre: "Pokémon Super Y", tipo: "locke" }
    ]
  },
  {
    nombre: "Pedro",
    foto: "pedro",
    lockes: [
      { nombre: "Pokémon X", tipo: "locke" },
      { nombre: "Pokémon Rubí Omega", tipo: "locke" },
      { nombre: "Bebelocke 1", tipo: "bebe" },
      { nombre: "Pokémon Añil", tipo: "locke" },
      { nombre: "Pokémon Blanco 2", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Pokémon Luna", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Bebelocke 2", tipo: "bebe" }
    ]
  }
];

const EXTENSIONES = ["png", "jpg", "jpeg", "webp"];

function urlsFoto(foto) {
  return EXTENSIONES.map((extension) => `img/jugadores/${foto}.${extension}`);
}

function contar(lockes, tipo) {
  return lockes.filter((locke) => locke.tipo === tipo).length;
}

function plantillaContador(lockes, tipo) {
  const total = contar(lockes, tipo);
  return `
    <div class="contador-locke ${tipo}">
      <span class="contador-numero">${total}</span>
      <span class="contador-tipo">${total === 1 ? TIPOS[tipo].singular : TIPOS[tipo].plural}</span>
    </div>`;
}

function plantillaLocke({ nombre, tipo, nota }) {
  return `
    <li class="locke-ganado ${tipo}" title="${TIPOS[tipo].singular}">
      <span class="locke-nombre">${nombre}</span>
      ${nota ? `<span class="locke-nota">${nota}</span>` : ""}
    </li>`;
}

function plantillaJugador({ nombre, foto, lockes }) {
  const imagen = imagenConRespaldo(urlsFoto(foto), `alt="${nombre}" data-quitar-si-falla`);
  return `
    <article class="ficha-jugador">
      <div class="jugador-foto" data-inicial="${nombre[0]}">${imagen}</div>
      <h2 class="jugador-nombre">${nombre}</h2>

      <div class="contadores-locke">
        ${Object.keys(TIPOS).map((tipo) => plantillaContador(lockes, tipo)).join("")}
      </div>

      <ul class="lockes-ganados">
        ${lockes.map(plantillaLocke).join("")}
      </ul>
    </article>`;
}

export function iniciar() {
  document.querySelector("#vista-jugadores .jugadores").innerHTML =
    JUGADORES.map(plantillaJugador).join("");
}

export function mostrar() {
  // contenido fijo: no hay nada que actualizar
}
