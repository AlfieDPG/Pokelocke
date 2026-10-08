import { quitarAcentos, normalizarNombre } from "./utilidades.js";

// ---------- Carga de datos (nombres en español e inglés) ----------

// NO cambiar esta clave sin motivo: si se cambia, se vuelven a descargar los datos
const CLAVE_DATOS = "poketeams-datos-v7";

// Nombres que en español salen repetidos y hay que distinguir (id -> nombre)
const NOMBRES_CORREGIDOS = {
  habilidades: { 266: "Unidad Ecuestre (Glastrier)", 267: "Unidad Ecuestre (Spectrier)" }
};

function corregirNombres(lista, correcciones) {
  for (const entrada of lista) {
    if (correcciones[entrada.id]) entrada.es = correcciones[entrada.id];
  }
  return lista;
}

const URLS_BASE = [
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/",
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/main/data/v2/csv/"
];

// Nombres de Pokémon, ataques, habilidades y objetos. Vale null hasta que termina cargarDatos().
export let datos = null;

async function descargarCSV(archivo) {
  for (const base of URLS_BASE) {
    try {
      const respuesta = await fetch(base + archivo);
      if (respuesta.ok) return await respuesta.text();
    } catch (error) {
      // probamos con la siguiente dirección
    }
  }
  throw new Error("No se pudo descargar " + archivo);
}

// Convierte el CSV en una lista de { id, es, en }
// Idioma 7 = español, idioma 9 = inglés
function leerNombres(csv) {
  const nombres = {};
  const lineas = csv.split("\n").slice(1);

  for (const linea of lineas) {
    const partes = linea.split(",");
    const id = Number(partes[0]);
    const idioma = partes[1];
    const nombre = (partes[2] || "").replace(/"/g, "").trim();

    if (!nombre || !id || id >= 10000) continue;
    if (!nombres[id]) nombres[id] = {};
    if (idioma === "7") nombres[id].es = nombre;
    if (idioma === "9") nombres[id].en = nombre;
  }

  return Object.entries(nombres)
    .filter(([id, n]) => n.en)
    .map(([id, n]) => ({ id: Number(id), en: n.en, es: n.es || n.en }));
}

function prepararBusqueda(lista) {
  for (const entrada of lista) {
    entrada.buscar = quitarAcentos(entrada.es + " " + entrada.en);
  }
}

async function leerODescargar() {
  try {
    localStorage.removeItem("poketeams-datos-v1"); // versión antigua
    localStorage.removeItem("poketeams-datos-v2"); // versión antigua
    localStorage.removeItem("poketeams-datos-v3"); // versión antigua
    localStorage.removeItem("poketeams-datos-v4"); // versión antigua
    localStorage.removeItem("poketeams-datos-v5"); // versión antigua (con formas en el buscador)
    localStorage.removeItem("poketeams-datos-v6"); // versión antigua (Unidad Ecuestre repetida)
    const guardado = localStorage.getItem(CLAVE_DATOS);
    if (guardado) return JSON.parse(guardado);
  } catch (error) {
    // si falla la lectura, descargamos de nuevo
  }

  const [csvAtaques, csvHabilidades, csvPokemon, csvObjetos] = await Promise.all([
    descargarCSV("move_names.csv"),
    descargarCSV("ability_names.csv"),
    descargarCSV("pokemon_species_names.csv"),
    descargarCSV("item_names.csv")
  ]);

  const nuevos = {
    ataques: leerNombres(csvAtaques),
    habilidades: corregirNombres(leerNombres(csvHabilidades), NOMBRES_CORREGIDOS.habilidades),
    pokemon: leerNombres(csvPokemon),
    objetos: leerNombres(csvObjetos)
  };

  prepararBusqueda(nuevos.ataques);
  prepararBusqueda(nuevos.habilidades);
  prepararBusqueda(nuevos.pokemon);
  prepararBusqueda(nuevos.objetos);

  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(nuevos));
  } catch (error) {
    // si no se puede guardar, no pasa nada: se descargará la próxima vez
  }

  return nuevos;
}

// Se puede llamar desde cualquier sección: solo carga los datos la primera vez
let promesaDatos = null;

export function cargarDatos() {
  if (!promesaDatos) {
    promesaDatos = leerODescargar().then((d) => (datos = d));
    promesaDatos.catch(() => (promesaDatos = null));
  }
  return promesaDatos;
}

// Índice nombre inglés normalizado -> entrada, creado la primera vez que se busca en cada lista
const indicesIngles = new WeakMap();

export function buscarPorNombreIngles(lista, nombre) {
  let indice = indicesIngles.get(lista);
  if (!indice) {
    indice = new Map();
    for (const entrada of lista) {
      const clave = normalizarNombre(entrada.en);
      if (!indice.has(clave)) indice.set(clave, entrada);
    }
    indicesIngles.set(lista, indice);
  }
  return indice.get(normalizarNombre(nombre)) || null;
}
