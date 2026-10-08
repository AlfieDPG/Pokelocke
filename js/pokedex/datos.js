// Estadísticas base de todos los Pokémon, incluidas las megaevoluciones y las formas
// alternativas (Palafin Héroe, Necrozma Ultra, Deoxys Ataque, las de Alola...).
//
// Solo entran las formas que CAMBIAN las estadísticas: con esa regla se quedan fuera
// solas las puramente estéticas (Gigamax, gorras de Pikachu, Vivillon, Unown...), que
// tienen las mismas que la forma normal. Si varias formas comparten estadísticas
// (los siete colores del núcleo de Minior, los tres Tatsugiri Mega...) solo sale una,
// porque en una tabla de estadísticas base serían filas repetidas.
//
// Todo sale de los CSV de PokeAPI, igual que el resto de datos de la web:
//   pokemon_stats.csv    -> las estadísticas de cada forma
//   pokemon.csv          -> qué formas hay, de qué especie y cuál es la normal
//   pokemon_species.csv  -> el nombre interno de la especie, que hace falta para la etiqueta
// Son unos 190 KB en total, así que la tabla ya montada se guarda en el navegador
// y solo se descarga la primera vez.

import { descargarCSV, cargarDatos, datos } from "../comun/datos.js";
import { etiquetaForma, formaVisible } from "../comun/formas.js";
import { leer, escribir } from "../comun/almacen.js";

// NO cambiar esta clave sin motivo: si se cambia, se vuelve a descargar todo
const CLAVE_POKEDEX = "poketeams-pokedex-v3";

// Retratos de Mundo Misterioso: cada forma es una subcarpeta numerada por su posición
// entre las variedades de la especie, en el orden de PokeAPI (la normal es la 0).
// Mundo Misterioso casi siempre numera igual, pero no siempre. Estas son las que no
// coinciden, comprobadas una a una contra su tracker.json; las que valen 0 es que no
// tienen retrato propio, así que se usa el de la especie.
const CORRECCIONES_PMD = {
  10071: 2, // Slowbro Mega (Mundo Misterioso pone la de Galar delante)
  10165: 1, // Slowbro de Galar
  10117: 1, // Greninja Ash
  10294: 2, // Greninja Mega
  10061: 5, // Floette Eterna
  10296: 6, // Floette Mega
  10181: 1, // Zygarde 10%
  10120: 2, // Zygarde Completa
  10136: 1, // Minior Núcleo
  10312: 2, // Darkrai Mega
  10314: 1, // Meowstic Mega
  10248: 0, // Basculegion hembra: Mundo Misterioso no tiene retrato suyo
  10254: 0, // Oinkologne hembra: tampoco
  10158: 0, // Pikachu Compañero: tampoco
  10159: 0  // Eevee Compañero: tampoco
};

// PokeAPI numera las estadísticas del 1 al 6 y en este orden:
// PS, Ataque, Defensa, Ataque especial, Defensa especial, Velocidad.
const TOTAL_ESTADISTICAS = 6;

// Se quita el salto de línea sobrante antes de partir: hay campos (is_default) que van
// los últimos de la línea y un "\r" pegado los dejaría inservibles.
function filasCSV(csv) {
  return csv.split("\n").slice(1).map((linea) => linea.trim().split(","));
}

// pokemon_stats.csv: pokemon_id,stat_id,base_stat,effort -> { idForma: [PS, At, Def, AtEsp, DefEsp, Vel] }
function leerEstadisticas(csv) {
  const bases = {};

  for (const [idTexto, estadisticaTexto, baseTexto] of filasCSV(csv)) {
    const id = Number(idTexto);
    const estadistica = Number(estadisticaTexto);
    if (!id || !estadistica || estadistica > TOTAL_ESTADISTICAS) continue;

    if (!bases[id]) bases[id] = [];
    bases[id][estadistica - 1] = Number(baseTexto);
  }

  return bases;
}

// pokemon.csv: id,identifier,species_id,...,is_default -> una entrada por forma
function leerVariedades(csv) {
  const variedades = [];

  for (const partes of filasCSV(csv)) {
    const id = Number(partes[0]);
    const especie = Number(partes[2]);
    if (!id || !especie) continue;

    variedades.push({ id, slug: partes[1], especie, porDefecto: partes[7] === "1" });
  }

  return variedades;
}

// pokemon_species.csv: id,identifier,... -> { idEspecie: "deoxys" }
// Hace falta porque el nombre de la forma normal no siempre es el de la especie
// ("deoxys-normal" es la forma; "deoxys" es la especie) y etiquetaForma espera el segundo.
function leerEspecies(csv) {
  const slugs = {};

  for (const partes of filasCSV(csv)) {
    const id = Number(partes[0]);
    if (id) slugs[id] = partes[1];
  }

  return slugs;
}

function completo(bases) {
  return (bases || []).length === TOTAL_ESTADISTICAS && bases.every(Number.isFinite);
}

function suma(numeros) {
  return numeros.reduce((total, n) => total + n, 0);
}

// Formas de una especie que salen en la tabla: la normal primero y después las que
// tengan unas estadísticas que no se hayan visto ya.
function formasConEstadisticasPropias(variedades, bases) {
  const normal = variedades.find((v) => v.porDefecto);
  if (!normal || !completo(bases[normal.id])) return [];

  const vistas = new Set([String(bases[normal.id])]);
  const elegidas = [];

  // Cuando varias formas comparten estadísticas hay que quedarse con una sola. Se prefiere
  // la que el resto de la web da por buena (formaVisible deja fuera Gigamax, tótems...) y,
  // entre esas, la de nombre más corto: así sale "zygarde-10" y no "zygarde-10-power-construct".
  const candidatas = variedades
    .filter((v) => !v.porDefecto && completo(bases[v.id]))
    .sort(
      (a, b) =>
        Number(!formaVisible(a.slug)) - Number(!formaVisible(b.slug)) ||
        a.slug.length - b.slug.length ||
        a.id - b.id
    );

  for (const variedad of candidatas) {
    const linea = String(bases[variedad.id]);
    if (vistas.has(linea)) continue;
    vistas.add(linea);
    elegidas.push(variedad);
  }

  // Ya elegidas, se muestran en el orden de PokeAPI (que es el de los juegos)
  return [normal, ...elegidas.sort((a, b) => a.id - b.id)];
}

// Número de subcarpeta del retrato de cada forma (ver CORRECCIONES_PMD)
function indicesPMD(variedades) {
  const indices = new Map();

  variedades
    .filter((v) => !v.porDefecto)
    .sort((a, b) => a.id - b.id)
    .forEach((v, posicion) => indices.set(v.id, posicion + 1));

  return indices;
}

function formaPMD(variedad, indices) {
  const correccion = CORRECCIONES_PMD[variedad.id];
  if (correccion !== undefined) return correccion;
  return variedad.porDefecto ? 0 : indices.get(variedad.id) || 0;
}

function montarTabla(bases, variedades, slugsEspecie) {
  const porEspecie = new Map();
  for (const variedad of variedades) {
    if (!porEspecie.has(variedad.especie)) porEspecie.set(variedad.especie, []);
    porEspecie.get(variedad.especie).push(variedad);
  }

  const nombres = new Map(datos.pokemon.map((p) => [p.id, p.es]));
  const filas = [];

  for (const especie of [...porEspecie.keys()].sort((a, b) => a - b)) {
    const nombre = nombres.get(especie);
    if (!nombre) continue; // especie sin nombre: no se puede mostrar

    const indices = indicesPMD(porEspecie.get(especie));

    for (const variedad of formasConEstadisticasPropias(porEspecie.get(especie), bases)) {
      const etiqueta = variedad.porDefecto ? "" : etiquetaForma(variedad.slug, slugsEspecie[especie]);

      filas.push({
        clave: variedad.id,   // id de PokeAPI: único, también para las formas
        numero: especie,      // número de la Pokédex: la forma comparte el de su especie
        forma: formaPMD(variedad, indices), // subcarpeta del retrato de Mundo Misterioso
        nombre: etiqueta && etiqueta !== "Normal" ? `${nombre} (${etiqueta})` : nombre,
        bases: bases[variedad.id],
        total: suma(bases[variedad.id])
      });
    }
  }

  return filas;
}

// Lista ordenada por número de Pokédex (y cada especie seguida de sus formas):
// { clave, numero, nombre, bases: [PS, At, Def, AtEsp, DefEsp, Vel], total }
export async function cargarPokedex() {
  try {
    localStorage.removeItem("poketeams-pokedex-v1"); // versión antigua (sin formas alternativas)
    localStorage.removeItem("poketeams-pokedex-v2"); // versión antigua (sin el retrato de cada forma)
  } catch (error) {
    // si el navegador no deja tocar el almacén, da igual: solo es limpieza
  }

  const guardada = leer(CLAVE_POKEDEX, null);
  if (guardada) return guardada;

  await cargarDatos(); // nombres en español de las especies

  const [csvEstadisticas, csvPokemon, csvEspecies] = await Promise.all([
    descargarCSV("pokemon_stats.csv"),
    descargarCSV("pokemon.csv"),
    descargarCSV("pokemon_species.csv")
  ]);

  const tabla = montarTabla(
    leerEstadisticas(csvEstadisticas),
    leerVariedades(csvPokemon),
    leerEspecies(csvEspecies)
  );

  escribir(CLAVE_POKEDEX, tabla);
  return tabla;
}
