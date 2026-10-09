// Bocadillo de la Pokédex: al pulsar la foto de un Pokémon sale, pegada a ella, su línea
// evolutiva entera (con las ramas, como las de Eevee) y cómo evoluciona cada uno.
//
// Sale de PokeAPI: pokemon-species/{n} dice cuál es su cadena y evolution-chain/{id} la da
// entera. Los nombres de especies, objetos y ataques, en español, de datos/nombres.json.

import { pedirJSON, URL_API } from "../comun/api.js";
import { cargarDatos, datos } from "../comun/datos.js";
import { imagenConRespaldo, urlsPMD, urlSpritePixel } from "../comun/imagenes.js";
import { tiposEs } from "../comun/tipos.js";
import { escaparHTML } from "../comun/utilidades.js";

let bocadillo = null;
let abiertoDe = null; // botón de la foto que lo ha abierto

// ---------- Nombres ----------

// "https://pokeapi.co/api/v2/item/82/" -> 82
function idDeUrl(url) {
  return Number(String(url || "").split("/").filter(Boolean).pop());
}

const indices = new Map(); // lista de datos -> Map(id -> entrada)

function nombreEn(lista, recurso) {
  if (!recurso) return "";
  if (!indices.has(lista)) indices.set(lista, new Map(lista.map((entrada) => [entrada.id, entrada])));
  const entrada = indices.get(lista).get(idDeUrl(recurso.url));
  // Si no está (algo muy nuevo), el nombre interno un poco arreglado: "tart-apple" -> "Tart Apple"
  return entrada ? entrada.es : recurso.name.replace(/-/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

const especie = (recurso) => nombreEn(datos.pokemon, recurso);
const objeto = (recurso) => nombreEn(datos.objetos, recurso);
const ataque = (recurso) => nombreEn(datos.ataques, recurso);

// ---------- Cómo evoluciona ----------

const MOMENTOS = { day: "de día", night: "de noche", dusk: "al anochecer", "full-moon": "con luna llena" };

// Los que no son subir de nivel, usar un objeto o intercambiar. {ataque}: el que pide.
const ESPECIALES = {
  shed: "Al evolucionar Nincada, con hueco en el equipo y una Poké Ball",
  spin: "Girar con un dulce equipado",
  "tower-of-darkness": "Superar la Torre de la Oscuridad",
  "tower-of-waters": "Superar la Torre del Agua",
  "three-critical-hits": "Tres golpes críticos en un combate",
  "take-damage": "Tras recibir mucho daño sin debilitarse",
  "agile-style-move": "Usar {ataque} en estilo rápido 20 veces",
  "strong-style-move": "Usar {ataque} en estilo fuerte 20 veces",
  "recoil-damage": "Recibir 294 PS de daño de retroceso",
  "use-move": "Usar {ataque} 20 veces",
  "three-defeated-bisharp": "Derrotar a 3 Bisharp líderes",
  "gimmighoul-coins": "Reunir 999 monedas de Gimmighoul",
  other: "Método especial"
};

const TRIGGERS_CON_ATAQUE = ["agile-style-move", "strong-style-move", "use-move"];

function textoDetalle(d) {
  const trigger = (d.trigger && d.trigger.name) || "";
  const partes = [];

  if (trigger === "level-up") partes.push(d.min_level ? `Nivel ${d.min_level}` : "Subir de nivel");
  else if (trigger === "use-item") partes.push(objeto(d.item) || "Usar un objeto");
  else if (trigger === "trade") partes.push("Intercambio");
  else partes.push((ESPECIALES[trigger] || ESPECIALES.other).replace("{ataque}", ataque(d.known_move) || "un movimiento"));

  if (d.held_item) partes.push(`llevando ${objeto(d.held_item)}`);
  if (d.known_move && !TRIGGERS_CON_ATAQUE.includes(trigger)) partes.push(`sabiendo ${ataque(d.known_move)}`);
  if (d.known_move_type) partes.push(`sabiendo un movimiento de tipo ${tiposEs[d.known_move_type.name] || d.known_move_type.name}`);
  if (d.min_happiness) partes.push("con mucha amistad");
  if (d.min_affection) partes.push("con mucho afecto");
  if (d.min_beauty) partes.push("con mucha belleza");
  if (d.time_of_day) partes.push(MOMENTOS[d.time_of_day] || d.time_of_day);
  if (d.location) partes.push("en un lugar concreto");
  if (d.needs_overworld_rain) partes.push("con lluvia");
  if (d.party_species) partes.push(`con ${especie(d.party_species)} en el equipo`);
  if (d.party_type) partes.push(`con un Pokémon de tipo ${tiposEs[d.party_type.name] || d.party_type.name} en el equipo`);
  if (d.relative_physical_stats === 1) partes.push("con más Ataque que Defensa");
  if (d.relative_physical_stats === -1) partes.push("con más Defensa que Ataque");
  if (d.relative_physical_stats === 0) partes.push("con el mismo Ataque que Defensa");
  if (d.trade_species) partes.push(`por ${especie(d.trade_species)}`);
  if (d.turn_upside_down) partes.push("con la consola boca abajo");
  if (d.gender === 1) partes.push("(hembra)");
  if (d.gender === 2) partes.push("(macho)");

  return partes.join(", ");
}

// PokeAPI da una forma por juego (Leafeon: en un lugar concreto en unos, con Piedra Hoja en
// otros): se enseñan las distintas, una por línea, como mucho tres
function textoMetodos(detalles) {
  const textos = [...new Set((detalles || []).map(textoDetalle).filter(Boolean))].slice(0, 3);
  return textos.map((texto) => `<span>${escaparHTML(texto)}</span>`).join("");
}

// ---------- Pintar ----------

function retrato(id) {
  return imagenConRespaldo([...urlsPMD({ id }), urlSpritePixel(id)], `class="evo-cara" alt="" data-quitar-si-falla`);
}

function plantillaEslabon(eslabon, actual) {
  const id = idDeUrl(eslabon.species.url);
  const hijos = eslabon.evolves_to || [];
  return `
    <div class="evo-rama">
      <div class="evo-pokemon ${id === actual ? "actual" : ""}">
        ${retrato(id)}
        <span>${escaparHTML(especie(eslabon.species))}</span>
      </div>
      ${hijos.length
        ? `<div class="evo-hijos">${hijos
            .map(
              (hijo) => `
                <div class="evo-paso">
                  <div class="evo-metodo">${textoMetodos(hijo.evolution_details)}<span class="evo-flecha">→</span></div>
                  ${plantillaEslabon(hijo, actual)}
                </div>`
            )
            .join("")}</div>`
        : ""}
    </div>`;
}

async function cadenaDe(numero) {
  const [datosEspecie] = await Promise.all([pedirJSON(`${URL_API}pokemon-species/${numero}`), cargarDatos()]);
  return pedirJSON(datosEspecie.evolution_chain.url);
}

// Pegado a la foto: debajo si cabe y si no encima, sin salirse por los lados. La flecha del
// bocadillo apunta siempre al centro de la foto.
function colocar() {
  if (!bocadillo || !abiertoDe) return;
  const foto = abiertoDe.getBoundingClientRect();
  const ancho = bocadillo.offsetWidth;
  const alto = bocadillo.offsetHeight;
  const margen = 8;

  const izquierda = Math.max(margen, Math.min(foto.left - 16, window.innerWidth - ancho - margen));
  const debajo = foto.bottom + 10 + alto <= window.innerHeight || foto.top - 10 - alto < 0;
  const arriba = debajo ? foto.bottom + 10 : foto.top - 10 - alto;

  bocadillo.classList.toggle("encima", !debajo);
  bocadillo.style.left = `${izquierda + window.scrollX}px`;
  bocadillo.style.top = `${arriba + window.scrollY}px`;
  bocadillo.style.setProperty("--flecha", `${foto.left + foto.width / 2 - izquierda}px`);
}

export function cerrarEvoluciones() {
  if (bocadillo) bocadillo.remove();
  bocadillo = null;
  abiertoDe = null;
}

// boton: la foto pulsada; numero: su número de la Pokédex. Pulsar la misma otra vez lo cierra.
export async function abrirEvoluciones(boton, numero) {
  if (abiertoDe === boton) {
    cerrarEvoluciones();
    return;
  }
  cerrarEvoluciones();

  abiertoDe = boton;
  bocadillo = document.createElement("div");
  bocadillo.className = "bocadillo-evo";
  bocadillo.innerHTML = `<p class="evo-aviso">Cargando...</p>`;
  document.body.appendChild(bocadillo);
  colocar();

  const este = bocadillo;
  let html;
  try {
    const cadena = await cadenaDe(numero);
    html = (cadena.chain.evolves_to || []).length
      ? `<div class="evo-arbol">${plantillaEslabon(cadena.chain, numero)}</div>`
      : `<div class="evo-arbol">${plantillaEslabon(cadena.chain, numero)}<p class="evo-aviso">No evoluciona.</p></div>`;
  } catch (error) {
    console.error(error);
    html = `<p class="evo-aviso">No se ha podido cargar. Revisa tu conexión.</p>`;
  }
  if (bocadillo !== este) return; // mientras cargaba se ha cerrado o se ha abierto otro
  bocadillo.innerHTML = html;
  colocar();
}

// ---------- Cerrar ----------

document.addEventListener("click", (e) => {
  if (bocadillo && !bocadillo.contains(e.target) && !(abiertoDe && abiertoDe.contains(e.target))) cerrarEvoluciones();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarEvoluciones();
});
window.addEventListener("resize", colocar);
