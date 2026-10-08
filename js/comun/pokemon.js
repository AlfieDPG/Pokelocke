import { pedirJSON, URL_API } from "./api.js";
import { etiquetaForma, obtenerVariedades } from "./formas.js";
import { indicePMD } from "./formas-pmd.js";

// Icono estilo HOME/Switch (el mismo que se usa en Espada/Escudo y versiones posteriores)
function obtenerSpriteIcono(p) {
  const v = p.sprites.versions || {};
  const gen8 = v["generation-viii"] && v["generation-viii"].icons && v["generation-viii"].icons.front_default;
  const gen7 = v["generation-vii"] && v["generation-vii"].icons && v["generation-vii"].icons.front_default;
  return gen8 || gen7 || p.sprites.front_default;
}

function extraerDescripcion(m) {
  const es = (m.flavor_text_entries || []).find((e) => e.language.name === "es");
  if (es) return es.flavor_text.replace(/[\n\f\r]+/g, " ").trim();

  const en = (m.effect_entries || []).find((e) => e.language.name === "en");
  if (en) return (en.short_effect || en.effect || "").replace(/[\n\f\r]+/g, " ").trim();

  return "";
}

// Texto más reciente de una lista de PokeAPI (objetos usan «text»; el resto, «flavor_text»).
// En español; si no lo hay (objetos y habilidades muy nuevos), en inglés.
function textoReciente(entradas, idiomas = ["es", "en"]) {
  for (const idioma of idiomas) {
    const textos = (entradas || []).filter((e) => e.language.name === idioma);
    const ultima = textos[textos.length - 1];
    if (ultima) return (ultima.text || ultima.flavor_text || "").replace(/[\n\f\r]+/g, " ").trim();
  }
  return "";
}

export async function descripcionHabilidad(id) {
  return textoReciente((await pedirJSON(`${URL_API}ability/${id}`)).flavor_text_entries);
}

// Objetos: PokeAPI no tiene texto en español de muchos objetos de los juegos de Switch
// (Dado Trucado, Energía Potenciadora...). Para esos se usan las descripciones de WikiDex
// (datos/descripciones-objetos.json, sacado de su «Lista de objetos»). Si tampoco está ahí,
// la de PokeAPI o Pokémon Showdown en inglés.
const URL_WIKIDEX = new URL("../../datos/descripciones-objetos.json", import.meta.url);
let textosWikidex = null; // se descarga una sola vez y solo si hace falta

async function descripcionWikidex(nombreIngles) {
  if (!textosWikidex) {
    textosWikidex = fetch(URL_WIKIDEX)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  const clave = nombreIngles.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (await textosWikidex)[clave] || "";
}

const URL_TEXTOS_SHOWDOWN = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text/items.ts";
let textosShowdown = null; // se descarga una sola vez y solo si hace falta

async function descripcionShowdown(nombreIngles) {
  if (!textosShowdown) {
    textosShowdown = fetch(URL_TEXTOS_SHOWDOWN)
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
  }
  const texto = await textosShowdown;

  // Cada objeto es un bloque "\tloadeddice: { ... \t}," con su shortDesc (o desc)
  const clave = nombreIngles.toLowerCase().replace(/[^a-z0-9]/g, "");
  const inicio = texto.indexOf(`\n\t${clave}: {`);
  if (inicio < 0) return "";
  const bloque = texto.slice(inicio, texto.indexOf("\n\t},", inicio));
  const encontrado = bloque.match(/shortDesc: "((?:[^"\\]|\\.)*)"/) || bloque.match(/desc: "((?:[^"\\]|\\.)*)"/);
  return encontrado ? encontrado[1].replace(/\\(.)/g, "$1") : "";
}

export async function descripcionObjeto(objeto) {
  const entradas = (await pedirJSON(`${URL_API}item/${objeto.id}`)).flavor_text_entries;
  return (
    textoReciente(entradas, ["es"]) ||
    (await descripcionWikidex(objeto.en)) ||
    textoReciente(entradas, ["en"]) ||
    descripcionShowdown(objeto.en)
  );
}

const CATEGORIAS = { physical: "Físico", special: "Especial", status: "Estado" };

function datosCombate(m) {
  return {
    potencia: m.power || null,
    precision: m.accuracy || null,
    categoria: CATEGORIAS[m.damage_class && m.damage_class.name] || ""
  };
}

// Potencia, precisión y categoría (para los ataques añadidos antes de guardarlas)
export async function obtenerDatosCombate(ataque) {
  return datosCombate(await pedirJSON(`${URL_API}move/${ataque.id}`));
}

// Forma para mostrar junto al nombre: nada si es la forma normal
export function textoForma(poke) {
  return poke.forma && poke.forma !== "Forma Normal" ? poke.forma : null;
}

// Stats base en este orden: PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad
const ORDEN_STATS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

function statsBase(p) {
  return ORDEN_STATS.map((nombre) => {
    const s = p.stats.find((x) => x.stat.name === nombre);
    return s ? s.base_stat : 0;
  });
}

// Stats base de un Pokémon del equipo (para los que se añadieron antes de guardarlas)
export async function obtenerStats(poke) {
  const p = await pedirJSON(`${URL_API}pokemon/${poke.idForma || poke.id}`);
  return statsBase(p);
}

// Crea el Pokémon del equipo a partir de los datos de PokeAPI
export async function pokemonDesdeAPI(p, entrada) {
  const imagen =
    (p.sprites.other &&
      p.sprites.other["official-artwork"] &&
      p.sprites.other["official-artwork"].front_default) ||
    p.sprites.front_default ||
    "";

  let info = { especie: "", lista: [] };
  try {
    info = await obtenerVariedades(entrada.id);
  } catch (error) {
    // sin información de formas: se trata como forma normal
  }
  const posicion = info.lista.indexOf(p.name);
  // Solo se guarda la forma si no es la normal (Alola, Mega, Galar...)
  const etiqueta = info.lista.length > 1 && posicion >= 0 ? etiquetaForma(p.name, info.especie) : "Normal";

  // Lo que PokeAPI le añade al nombre de la especie ("meowstic-female-mega" -> "female-mega").
  // Hace falta para exportar el equipo con el nombre que entiende Showdown.
  const sufijoForma =
    info.especie && p.name.startsWith(info.especie + "-") ? p.name.slice(info.especie.length + 1) : "";

  return {
    id: entrada.id,
    idForma: p.id,
    formaSlug: sufijoForma,
    es: entrada.es,
    en: entrada.en,
    mote: null,
    imagen: imagen,
    sprite: obtenerSpriteIcono(p) || imagen,
    shiny: false,
    forma: etiqueta === "Normal" ? null : "Forma " + etiqueta,
    formaPMD: indicePMD(p.id, posicion > 0 ? posicion : 0),
    tipos: p.types.map((t) => t.type.name),
    stats: statsBase(p),
    habilidad: null,
    objeto: null,
    ataques: [null, null, null, null]
  };
}

// Crea el ataque a partir de su entrada en la lista de nombres
export async function ataqueDesdeAPI(entrada) {
  const m = await pedirJSON(`${URL_API}move/${entrada.id}`);
  const ppMax = m.pp || 1;

  return {
    id: entrada.id,
    es: entrada.es,
    en: entrada.en,
    tipo: m.type.name,
    ppMax: ppMax,
    pp: ppMax,
    descripcion: extraerDescripcion(m),
    ...datosCombate(m)
  };
}
