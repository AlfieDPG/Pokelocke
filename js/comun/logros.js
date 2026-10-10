// ---------- Logros ----------
//
// Cada logro se consigue solo, al hacer algo en la web: ganar lockes, perder Pokémon,
// guardar equipos, marcar rutas, crear normas... No hay que avisar desde cada sitio: se mira
// lo que ya hay guardado (equipos, lockes, cementerio, rutas, perfil...) cada vez que algo
// cambia, y los que se cumplen se apuntan. Así cuentan también las cosas hechas antes de que
// hubiera logros.
//
// Los conseguidos van en tu perfil (perfiles/{uid}.logros: { idLogro: fecha }), que es lo que
// pueden leer tus amigos en tu ficha. Por eso hace falta sesión para conseguirlos. Una vez
// conseguido no se pierde, aunque luego borres lo que lo dio.
//
// Lo que no deja rastro en ningún sitio (tirar de la ruleta, exportar un equipo...) se cuenta
// en js/comun/contadores.js.
//
// Para añadir uno: una entrada más en LOGROS. «valor» recibe el contexto (ver contexto()) y
// devuelve un número; se consigue al llegar a «meta» (1 si no se dice). NO cambiar los id: son
// los que están guardados en los perfiles.

import { leer, alCambiar } from "./almacen.js";
import { usuarioActual, alCambiarSesion, cuandoEsteSincronizado } from "./nube.js";
import { miPerfil, alCambiarMiPerfil, guardarMiPerfil, amigosAceptados, alCambiarAmistades } from "./perfiles.js";
import { misLockes, estadoDe, alCambiarLockes } from "./lockes.js";
import { conjuntos } from "./normas.js";
import { contadores } from "./contadores.js";
import { icono } from "./iconos.js";
import { escaparHTML } from "./utilidades.js";

export const NIVELES = {
  bronce: "Bronce",
  plata: "Plata",
  oro: "Oro",
  platino: "Platino"
};

export const CATEGORIAS = [
  { id: "versus", nombre: "Versus" },
  { id: "cementerio", nombre: "Cementerio" },
  { id: "equipos", nombre: "Equipos" },
  { id: "rutas", nombre: "Rutas y level caps" },
  { id: "personalizados", nombre: "A tu manera" },
  { id: "social", nombre: "Amigos y perfil" },
  { id: "otros", nombre: "Otros" },
  { id: "logros", nombre: "Logros" }
];

const cuantos = (lista, condicion) => lista.filter(condicion).length;

// Un locke apuntado a mano en tu palmarés: ¿era de vidas ilimitadas? Los de antes no lo
// llevan apuntado y se deduce de las vidas de los participantes (igual que en «Amigos»)
function apuntadoIlimitado(ganado) {
  if (typeof ganado.vidasIlimitadas === "boolean") return ganado.vidasIlimitadas;
  const participantes = ganado.participantes || [];
  return participantes.length > 0 && participantes.every((p) => p.vidas === null);
}

export const LOGROS = [
  // ---------- Versus ----------
  { id: "v-primer-locke", categoria: "versus", nivel: "bronce", icono: "espadas",
    nombre: "Primeros pasos", descripcion: "Juega tu primer locke.",
    valor: (c) => c.jugados },
  { id: "v-crear", categoria: "versus", nivel: "bronce", icono: "mas",
    nombre: "Anfitrión", descripcion: "Crea un locke.",
    valor: (c) => cuantos(c.lockes, (l) => l.creador === c.yo) },
  { id: "v-con-amigos", categoria: "versus", nivel: "bronce", icono: "amigos",
    nombre: "Cuantos más, mejor", descripcion: "Juega un locke con al menos un amigo.",
    valor: (c) => c.masJugadores >= 2 },
  { id: "v-cuatro", categoria: "versus", nivel: "plata", icono: "amigos",
    nombre: "Todos contra todos", descripcion: "Juega un locke de 4 jugadores o más.",
    valor: (c) => c.masJugadores, meta: 4 },
  { id: "v-terminar", categoria: "versus", nivel: "bronce", icono: "visto",
    nombre: "Hasta el final", descripcion: "Termina un locke.",
    valor: (c) => c.terminados.length + c.apuntados.length },
  { id: "v-ilimitadas", categoria: "versus", nivel: "bronce", icono: "corazon",
    nombre: "Sin presión", descripcion: "Juega un locke con vidas ilimitadas.",
    valor: (c) => cuantos(c.lockes, (l) => l.vidasIlimitadas) + cuantos(c.apuntados, apuntadoIlimitado) },
  { id: "v-jugar-5", categoria: "versus", nivel: "plata", icono: "espadas",
    nombre: "Veterano", descripcion: "Juega 5 lockes.",
    valor: (c) => c.jugados, meta: 5 },
  { id: "v-jugar-15", categoria: "versus", nivel: "oro", icono: "espadas",
    nombre: "Incansable", descripcion: "Juega 15 lockes.",
    valor: (c) => c.jugados, meta: 15 },
  { id: "v-ganar-1", categoria: "versus", nivel: "bronce", icono: "corona",
    nombre: "¡Campeón!", descripcion: "Gana un locke.",
    valor: (c) => c.ganados },
  { id: "v-ganar-5", categoria: "versus", nivel: "plata", icono: "corona",
    nombre: "Leyenda en ciernes", descripcion: "Gana 5 lockes.",
    valor: (c) => c.ganados, meta: 5 },
  { id: "v-ganar-10", categoria: "versus", nivel: "oro", icono: "corona",
    nombre: "Leyenda", descripcion: "Gana 10 lockes.",
    valor: (c) => c.ganados, meta: 10 },
  { id: "v-ganar-25", categoria: "versus", nivel: "platino", icono: "trofeo",
    nombre: "Maestro Pokémon", descripcion: "Gana 25 lockes.",
    valor: (c) => c.ganados, meta: 25 },
  { id: "v-intocable", categoria: "versus", nivel: "oro", icono: "escudo",
    nombre: "Intocable", descripcion: "Gana un locke sin perder ni una vida.",
    valor: (c) => cuantos(c.mios, (l) => !l.vidasIlimitadas && (l.vidasIniciales || 0) > 0 && c.vidasDe(l) >= l.vidasIniciales) },
  { id: "v-limite", categoria: "versus", nivel: "plata", icono: "corazon",
    nombre: "Al límite", descripcion: "Gana un locke con una sola vida.",
    valor: (c) => cuantos(c.mios, (l) => !l.vidasIlimitadas && c.vidasDe(l) === 1) +
      cuantos(c.apuntados, (g) => !apuntadoIlimitado(g) && c.misVidasEn(g) === 1) },
  { id: "v-victorias-10", categoria: "versus", nivel: "bronce", icono: "espadas",
    nombre: "Luchador", descripcion: "Suma 10 victorias en tus lockes.",
    valor: (c) => c.victorias, meta: 10 },
  { id: "v-victorias-50", categoria: "versus", nivel: "plata", icono: "espadas",
    nombre: "Guerrero", descripcion: "Suma 50 victorias en tus lockes.",
    valor: (c) => c.victorias, meta: 50 },
  { id: "v-victorias-100", categoria: "versus", nivel: "oro", icono: "espadas",
    nombre: "Imparable", descripcion: "Suma 100 victorias en tus lockes.",
    valor: (c) => c.victorias, meta: 100 },

  // ---------- Cementerio ----------
  { id: "c-primer-muerto", categoria: "cementerio", nivel: "bronce", icono: "calavera",
    nombre: "Descanse en paz", descripcion: "Pierde tu primer Pokémon.",
    valor: (c) => c.muertos.length },
  { id: "c-con-mote", categoria: "cementerio", nivel: "bronce", icono: "etiqueta",
    nombre: "Nunca te olvidaremos", descripcion: "Apunta en el cementerio a un Pokémon con mote.",
    valor: (c) => cuantos(c.muertos, (m) => m.mote) },
  { id: "c-muertos-10", categoria: "cementerio", nivel: "plata", icono: "calavera",
    nombre: "Cementerio lleno", descripcion: "Pierde 10 Pokémon.",
    valor: (c) => c.muertos.length, meta: 10 },
  { id: "c-muertos-50", categoria: "cementerio", nivel: "oro", icono: "calavera",
    nombre: "Sepulturero", descripcion: "Pierde 50 Pokémon.",
    valor: (c) => c.muertos.length, meta: 50 },
  { id: "c-masacre", categoria: "cementerio", nivel: "plata", icono: "calavera",
    nombre: "Masacre", descripcion: "Pierde 6 Pokémon en un mismo locke.",
    valor: (c) => Math.max(0, ...c.lockes.map((l) => c.muertosDe(l).length)), meta: 6 },
  { id: "c-ni-rasguno", categoria: "cementerio", nivel: "oro", icono: "estrella",
    nombre: "Ni un rasguño", descripcion: "Gana un locke sin ningún Pokémon en tu cementerio.",
    valor: (c) => cuantos(c.mios, (l) => c.muertosDe(l).length === 0) },

  // ---------- Equipos ----------
  { id: "e-primero", categoria: "equipos", nivel: "bronce", icono: "pokeball",
    nombre: "Entrenador", descripcion: "Guarda tu primer equipo.",
    valor: (c) => c.equipos.length },
  { id: "e-cinco", categoria: "equipos", nivel: "plata", icono: "lista",
    nombre: "Estratega", descripcion: "Guarda 5 equipos.",
    valor: (c) => c.equipos.length, meta: 5 },
  { id: "e-quince", categoria: "equipos", nivel: "oro", icono: "lista",
    nombre: "Coleccionista", descripcion: "Guarda 15 equipos.",
    valor: (c) => c.equipos.length, meta: 15 },
  { id: "e-completo", categoria: "equipos", nivel: "bronce", icono: "pokeball",
    nombre: "Equipo al completo", descripcion: "Guarda un equipo de 6 Pokémon.",
    valor: (c) => c.equiposDeSeis.length },
  { id: "e-preparados", categoria: "equipos", nivel: "plata", icono: "espadas",
    nombre: "Bien preparados", descripcion: "Guarda un equipo de 6 con 4 ataques cada uno.",
    valor: (c) => cuantos(c.equiposDeSeis, (e) => e.pokemon.every((p) => (p.ataques || []).filter(Boolean).length === 4)) },
  { id: "e-equipados", categoria: "equipos", nivel: "plata", icono: "etiqueta",
    nombre: "Bien equipados", descripcion: "Guarda un equipo de 6 con un objeto cada uno.",
    valor: (c) => cuantos(c.equiposDeSeis, (e) => e.pokemon.every((p) => p.objeto)) },
  { id: "e-shiny", categoria: "equipos", nivel: "bronce", icono: "estrella",
    nombre: "Brillante", descripcion: "Guarda un equipo con un Pokémon variocolor.",
    valor: (c) => cuantos(c.pokemonGuardados, (p) => p.shiny) },
  { id: "e-motes", categoria: "equipos", nivel: "bronce", icono: "lapiz",
    nombre: "Con nombre propio", descripcion: "Guarda un equipo de 3 o más con mote todos.",
    valor: (c) => cuantos(c.equipos, (e) => e.pokemon.length >= 3 && e.pokemon.every((p) => p.mote)) },
  { id: "e-monotipo", categoria: "equipos", nivel: "oro", icono: "escudo",
    nombre: "Monotipo", descripcion: "Guarda un equipo de 6 que compartan un tipo.",
    valor: (c) => cuantos(c.equiposDeSeis, (e) => (e.pokemon[0].tipos || []).some((tipo) => e.pokemon.every((p) => (p.tipos || []).includes(tipo)))) },
  { id: "e-forma", categoria: "equipos", nivel: "bronce", icono: "mapa",
    nombre: "Viajero regional", descripcion: "Guarda un equipo con un Pokémon de otra forma (Alola, Mega...).",
    valor: (c) => cuantos(c.pokemonGuardados, (p) => p.forma) },
  { id: "e-importar", categoria: "equipos", nivel: "bronce", icono: "importar",
    nombre: "Desde Showdown", descripcion: "Importa un equipo con «Importar paste».",
    valor: (c) => c.contadores.importar || 0 },
  { id: "e-exportar", categoria: "equipos", nivel: "bronce", icono: "copiar",
    nombre: "Rumbo a Showdown", descripcion: "Exporta un equipo.",
    valor: (c) => c.contadores.exportar || 0 },
  { id: "e-destacar", categoria: "equipos", nivel: "bronce", icono: "estrella",
    nombre: "Escaparate", descripcion: "Destaca un equipo en tu perfil.",
    valor: (c) => (c.perfil.escaparate || []).length },

  // ---------- Rutas y level caps ----------
  { id: "r-primera", categoria: "rutas", nivel: "bronce", icono: "mapa",
    nombre: "Primera captura", descripcion: "Marca tu primer lugar en «Rutas».",
    valor: (c) => c.lugaresMarcados },
  { id: "r-50", categoria: "rutas", nivel: "plata", icono: "mapa",
    nombre: "Explorador", descripcion: "Marca 50 lugares en «Rutas».",
    valor: (c) => c.lugaresMarcados, meta: 50 },
  { id: "r-150", categoria: "rutas", nivel: "oro", icono: "mapa",
    nombre: "Trotamundos", descripcion: "Marca 150 lugares en «Rutas».",
    valor: (c) => c.lugaresMarcados, meta: 150 },
  { id: "r-completo", categoria: "rutas", nivel: "oro", icono: "mapa",
    nombre: "Cartógrafo", descripcion: "Marca todos los lugares de un juego.",
    valor: (c) => c.juegosConTodasLasRutas },
  { id: "l-primero", categoria: "rutas", nivel: "bronce", icono: "escudo",
    nombre: "Primer combate", descripcion: "Supera tu primer combate en «Level caps».",
    valor: (c) => c.combatesSuperados },
  { id: "l-campeon", categoria: "rutas", nivel: "plata", icono: "corona",
    nombre: "Campeón de la Liga", descripcion: "Supera al Campeón de un juego en «Level caps».",
    valor: (c) => c.campeonesSuperados },
  { id: "l-completo", categoria: "rutas", nivel: "oro", icono: "escudo",
    nombre: "Sin dejar a nadie", descripcion: "Supera todos los combates de un juego.",
    valor: (c) => c.juegosConTodosLosCombates },
  { id: "l-multiplicador", categoria: "rutas", nivel: "bronce", icono: "actividad",
    nombre: "Randomizer", descripcion: "Cambia el multiplicador de nivel en «Level caps».",
    valor: (c) => cuantos(Object.values(c.multiplicadores), (valor) => valor !== 1) },

  // ---------- Personalizados ----------
  { id: "p-normas", categoria: "personalizados", nivel: "bronce", icono: "libro",
    nombre: "Legislador", descripcion: "Crea un conjunto de normas.",
    valor: (c) => c.normas.length },
  { id: "p-normas-5", categoria: "personalizados", nivel: "plata", icono: "libro",
    nombre: "Código completo", descripcion: "Ten un conjunto con 5 normas o más.",
    valor: (c) => Math.max(0, ...c.normas.map((conjunto) => (conjunto.normas || []).length)), meta: 5 },
  { id: "p-rutas", categoria: "personalizados", nivel: "bronce", icono: "mapa",
    nombre: "Constructor de mundos", descripcion: "Crea unas rutas personalizadas.",
    valor: (c) => c.rutasPropias.length },
  { id: "p-caps", categoria: "personalizados", nivel: "bronce", icono: "escudo",
    nombre: "Diseñador de retos", descripcion: "Crea unos level caps personalizados.",
    valor: (c) => c.capsPropios.length },
  { id: "p-imagen", categoria: "personalizados", nivel: "bronce", icono: "imagen",
    nombre: "Artista", descripcion: "Ponle una imagen personalizada a un entrenador de tus level caps.",
    valor: (c) => cuantos(c.capsPropios.flatMap((lista) => lista.combates || []), (combate) => String(combate.imagen || "").startsWith("data:")) },
  { id: "p-tipo", categoria: "personalizados", nivel: "bronce", icono: "etiqueta",
    nombre: "A mi manera", descripcion: "Crea un tipo de locke propio.",
    valor: (c) => cuantos(c.perfil.tipos || [], (tipo) => tipo.id !== "locke") },
  { id: "p-locke", categoria: "personalizados", nivel: "plata", icono: "mando",
    nombre: "Fan game", descripcion: "Crea un locke con tus normas, rutas o level caps personalizados.",
    valor: (c) => cuantos(c.lockes, (l) => l.creador === c.yo &&
      ((l.normas && l.normas.id && l.normas.id !== "generales") || l.rutasPropias || l.capsPropios)) },

  // ---------- Amigos y perfil ----------
  { id: "s-amigo", categoria: "social", nivel: "bronce", icono: "amigos",
    nombre: "Compañero de viaje", descripcion: "Haz tu primer amigo.",
    valor: (c) => c.amigos },
  { id: "s-amigos-5", categoria: "social", nivel: "plata", icono: "amigos",
    nombre: "Popular", descripcion: "Ten 5 amigos.",
    valor: (c) => c.amigos, meta: 5 },
  { id: "s-amigos-10", categoria: "social", nivel: "oro", icono: "amigos",
    nombre: "Líder de grupo", descripcion: "Ten 10 amigos.",
    valor: (c) => c.amigos, meta: 10 },
  { id: "s-avatar", categoria: "social", nivel: "bronce", icono: "persona",
    nombre: "Nueva imagen", descripcion: "Pon un Pokémon como foto de perfil.",
    valor: (c) => Boolean(c.perfil.avatar) },

  // ---------- Otros ----------
  { id: "o-ruleta", categoria: "otros", nivel: "bronce", icono: "ruleta",
    nombre: "Que decida la suerte", descripcion: "Tira de la ruleta.",
    valor: (c) => c.contadores.ruleta || 0 },
  { id: "o-ruleta-25", categoria: "otros", nivel: "plata", icono: "ruleta",
    nombre: "Jugador empedernido", descripcion: "Tira de la ruleta 25 veces.",
    valor: (c) => c.contadores.ruleta || 0, meta: 25 },
  { id: "o-evoluciones", categoria: "otros", nivel: "bronce", icono: "pokedex",
    nombre: "Investigador", descripcion: "Mira la línea evolutiva de un Pokémon en la Pokédex.",
    valor: (c) => c.contadores.evoluciones || 0 },
  { id: "o-evoluciones-25", categoria: "otros", nivel: "plata", icono: "pokedex",
    nombre: "Profesor Pokémon", descripcion: "Mira 25 líneas evolutivas en la Pokédex.",
    valor: (c) => c.contadores.evoluciones || 0, meta: 25 },
  { id: "o-ayuda", categoria: "otros", nivel: "bronce", icono: "libro",
    nombre: "Curioso", descripcion: "Lee las preguntas frecuentes.",
    valor: (c) => c.contadores.ayuda || 0 },

  // ---------- Logros de logros (se miran los últimos, con los demás ya contados) ----------
  { id: "m-10", categoria: "logros", nivel: "plata", icono: "trofeo",
    nombre: "Cazalogros", descripcion: "Consigue 10 logros.",
    valor: (c) => c.conseguidos, meta: 10 },
  { id: "m-30", categoria: "logros", nivel: "oro", icono: "trofeo",
    nombre: "Coleccionista de logros", descripcion: "Consigue 30 logros.",
    valor: (c) => c.conseguidos, meta: 30 },
  { id: "m-todos", categoria: "logros", nivel: "platino", icono: "trofeo",
    nombre: "Completista", descripcion: "Consigue todos los demás logros.",
    valor: (c) => c.conseguidos }
];

const DE_LOGROS = new Set(LOGROS.filter((logro) => logro.categoria === "logros").map((logro) => logro.id));
LOGROS.find((logro) => logro.id === "m-todos").meta = LOGROS.length - 1;

export function metaDe(logro) {
  return logro.meta || 1;
}

// ---------- Contexto: todo lo que miran los logros ----------

// Las rutas y los level caps de los juegos de la web solo se descargan aquí (para saber si
// un juego está completo)
async function contexto() {
  const usuario = usuarioActual();
  const perfil = miPerfil() || {};
  const yo = usuario ? usuario.uid : null;
  const [{ LUGARES }, { COMBATES }] = await Promise.all([import("../rutas/datos.js"), import("../levelcaps/datos.js")]);

  const lockes = yo ? misLockes() : [];
  const terminados = lockes.filter((locke) => locke.estado === "cerrado");
  const mios = terminados.filter((locke) => locke.ganador === yo); // los que he ganado
  const muertosDe = (locke) => ((locke.muertos || {})[yo]) || [];
  const jugadoresDe = (locke) => (locke.jugadores || []).filter((uid) => estadoDe(locke, uid) === "aceptado").length;

  // Los lockes de tu palmarés que no son de Versus: los que apuntaste a mano (los de antes de
  // la web). Cuentan como jugados y terminados, además de ganados. Los de Versus que ganas
  // también se copian ahí: esos ya están en «lockes» y no se cuentan dos veces.
  const deVersus = new Set(lockes.map((locke) => locke.id));
  const apuntados = (perfil.ganados || []).filter((ganado) => !deVersus.has(ganado.id));
  const miNombre = String(perfil.nombre || "").trim().toLowerCase();
  const misVidasEn = (ganado) => {
    const yoEn = (ganado.participantes || []).find((p) => String(p.nombre || "").trim().toLowerCase() === miNombre);
    return yoEn && typeof yoEn.vidas === "number" ? yoEn.vidas : null;
  };

  const equipos = (leer("poketeams-equipos-v1", []) || []).filter((equipo) => Array.isArray(equipo.pokemon));
  const rutasTodas = ((leer("poketeams-rutas-propias-v1", null) || {}).listas) || [];
  const capsTodos = ((leer("poketeams-levelcaps-propios-v1", null) || {}).listas) || [];

  return {
    yo,
    perfil,
    lockes,
    terminados,
    mios,
    muertosDe,
    vidasDe: (locke) => (locke.vidas || {})[yo] || 0,
    apuntados,
    misVidasEn,
    jugados: lockes.length + apuntados.length,
    masJugadores: Math.max(0, ...lockes.map(jugadoresDe), ...apuntados.map((ganado) => (ganado.participantes || []).length)),
    muertos: lockes.flatMap(muertosDe),
    ganados: (perfil.ganados || []).length,
    victorias: lockes.reduce((suma, locke) => suma + ((locke.marcador || {})[yo] || 0), 0),
    amigos: yo ? amigosAceptados().length : 0,
    equipos,
    equiposDeSeis: equipos.filter((equipo) => equipo.pokemon.length === 6),
    pokemonGuardados: equipos.flatMap((equipo) => equipo.pokemon),
    normas: conjuntos(),
    rutasPropias: rutasTodas.filter((lista) => !lista.recibido),
    capsPropios: capsTodos.filter((lista) => !lista.recibido),
    multiplicadores: leer("poketeams-levelcaps-multiplicador-v1", {}) || {},
    contadores: contadores(),
    ...progresoRutas(LUGARES, rutasTodas),
    ...progresoCaps(COMBATES, capsTodos)
  };
}

// Lugares marcados en total, y en cuántos juegos están todos (de 10 lugares para arriba,
// para que unas rutas propias de dos lugares no valgan)
function progresoRutas(LUGARES, rutasTodas) {
  const marcadas = leer("poketeams-rutas-v2", {}) || {};
  let lugaresMarcados = 0;
  let juegosConTodasLasRutas = 0;

  for (const [idJuego, claves] of Object.entries(marcadas)) {
    lugaresMarcados += (claves || []).length;
    const textos = new Set((claves || []).map((clave) => clave.slice(clave.indexOf(":") + 1)));

    let lugares = [];
    const deLaWeb = LUGARES[idJuego];
    if (deLaWeb) {
      const apartados = deLaWeb.apartados || ["rutas", "ciudades", "postgame", "eventos"].map((clave) => ({ clave }));
      lugares = apartados.flatMap(({ clave }) => deLaWeb[clave] || []);
    } else {
      const propia = rutasTodas.find((lista) => lista.id === idJuego);
      if (propia) lugares = (propia.secciones || []).flatMap((seccion) => seccion.lugares || []);
    }
    if (lugares.length >= 10 && lugares.every((lugar) => textos.has(lugar))) juegosConTodasLasRutas++;
  }
  return { lugaresMarcados, juegosConTodasLasRutas };
}

// Combates superados en total, campeones superados y juegos con todos superados (de 8
// combates para arriba). Las claves son las de js/levelcaps/index.js (claveCombate).
function progresoCaps(COMBATES, capsTodos) {
  const superados = leer("poketeams-levelcaps-v2", {}) || {};
  let combatesSuperados = 0;
  let campeonesSuperados = 0;
  let juegosConTodosLosCombates = 0;

  for (const [idJuego, claves] of Object.entries(superados)) {
    const hechos = new Set(claves || []);
    combatesSuperados += hechos.size;

    const propio = capsTodos.find((lista) => lista.id === idJuego);
    const combates = (propio ? propio.combates : COMBATES[idJuego]) || [];
    const clave = (c) => c.id || `${c.etiqueta}|${c.nombre}|${c.lugar || ""}`;

    if (combates.some((c) => c.tipo === "campeon" && hechos.has(clave(c)))) campeonesSuperados++;
    const principales = combates.filter((c) => !c.seccion && (c.etiqueta || c.nombre));
    if (principales.length >= 8 && principales.every((c) => hechos.has(clave(c)))) juegosConTodosLosCombates++;
  }
  return { combatesSuperados, campeonesSuperados, juegosConTodosLosCombates };
}

// Cada logro con lo que lleva: { logro, valor, meta, conseguido (fecha o null) }.
// tengo: los que ya están apuntados en el perfil ({ id: fecha }).
export async function progreso(tengo = (miPerfil() || {}).logros || {}) {
  const ctx = await contexto();
  const filas = LOGROS.filter((logro) => !DE_LOGROS.has(logro.id)).map((logro) => fila(logro, ctx, tengo));
  ctx.conseguidos = filas.filter(hecho).length;

  // Los de logros, de menos a más: cada uno que se cumple cuenta ya para el siguiente
  const deLogros = LOGROS.filter((logro) => DE_LOGROS.has(logro.id)).sort((uno, otro) => metaDe(uno) - metaDe(otro));
  for (const logro of deLogros) {
    const suya = fila(logro, ctx, tengo);
    filas.push(suya);
    if (hecho(suya)) ctx.conseguidos++;
  }
  return filas;
}

const hecho = (cada) => Boolean(cada.conseguido) || cada.valor >= cada.meta;

function fila(logro, ctx, tengo) {
  let valor = 0;
  try {
    valor = Number(logro.valor(ctx)) || 0;
  } catch (error) {
    console.error(`No se ha podido mirar el logro ${logro.id}`, error);
  }
  return { logro, valor, meta: metaDe(logro), conseguido: tengo[logro.id] || null };
}

// ---------- Apuntar los nuevos ----------

const ESPERA = 1500; // ms tras el último cambio (para no mirar diez veces seguidas)
let temporizador = null;
let revisando = false;
let otraVez = false;

function programar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => revisar().catch((error) => console.error("No se han podido mirar los logros", error)), ESPERA);
}

async function revisar() {
  if (revisando) {
    otraVez = true;
    return;
  }
  revisando = true;
  try {
    await cuandoEsteSincronizado(); // si no, se miraría lo del navegador antes de juntarlo con la cuenta
    const perfil = miPerfil();
    if (!usuarioActual() || !perfil) return;

    const tengo = perfil.logros || {};
    const nuevos = (await progreso(tengo)).filter((cada) => !cada.conseguido && hecho(cada));
    if (!nuevos.length) return;

    const ahora = Date.now();
    await guardarMiPerfil(Object.fromEntries(nuevos.map((cada) => [`logros.${cada.logro.id}`, ahora])));
    anunciar(nuevos.map((cada) => cada.logro));
  } finally {
    revisando = false;
    if (otraVez) {
      otraVez = false;
      programar();
    }
  }
}

export function iniciarLogros() {
  alCambiarSesion(programar);
  alCambiarMiPerfil(programar);
  alCambiarLockes(programar);
  alCambiarAmistades(programar);
  alCambiar(programar); // equipos, rutas, normas, contadores...
}

// ---------- Aviso en pantalla ----------
//
// Abajo a la derecha, unos segundos. Si llegan muchos de golpe (la primera vez, con todo lo
// que ya habías hecho), uno solo que lo resume. Pulsándolo se abre «Logros».

let caja = null;

export function insignia(logro, conseguido = true) {
  return `<span class="logro-insignia ${escaparHTML(logro.nivel)} ${conseguido ? "" : "bloqueado"}">${icono(conseguido ? logro.icono : "candado")}</span>`;
}

// Una fanfarria cortita, de consola antigua, hecha por el navegador (sin archivos). Solo deja
// sonar después de que se haya tocado la página: por eso se prepara con el primer clic o tecla.
let audio = null;

function prepararAudio() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!audio && Contexto) audio = new Contexto();
}
for (const evento of ["pointerdown", "keydown"]) addEventListener(evento, prepararAudio, { once: true, capture: true });

function sonar() {
  if (!audio) return;
  if (audio.state === "suspended") audio.resume().catch(() => {});
  const inicio = audio.currentTime + 0.03;
  const notas = [[784, 0], [1047, 0.09], [1319, 0.18], [1568, 0.27]]; // sol, do, mi, sol
  notas.forEach(([frecuencia, cuando], i) => {
    const t = inicio + cuando;
    const dura = i === notas.length - 1 ? 0.5 : 0.12;
    const onda = audio.createOscillator();
    const volumen = audio.createGain();
    onda.type = "square";
    onda.frequency.value = frecuencia;
    volumen.gain.setValueAtTime(0.0001, t);
    volumen.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    volumen.gain.exponentialRampToValueAtTime(0.0001, t + dura);
    onda.connect(volumen).connect(audio.destination);
    onda.start(t);
    onda.stop(t + dura + 0.02);
  });
}

function anunciar(logros) {
  try {
    sonar();
  } catch (error) {
    console.error(error);
  }
  if (!caja) {
    caja = document.createElement("div");
    caja.className = "avisos-logro";
    document.body.appendChild(caja);
  }

  const avisos = logros.length > 3
    ? [{ html: `${insignia({ nivel: "oro", icono: "trofeo" })}<span><small>¡Logros conseguidos!</small><strong>${logros.length} logros nuevos</strong></span>` }]
    : logros.map((logro) => ({ html: `${insignia(logro)}<span><small>¡Logro conseguido!</small><strong>${escaparHTML(logro.nombre)}</strong></span>` }));

  avisos.forEach(({ html }, i) => {
    const aviso = document.createElement("button");
    aviso.className = "aviso-logro";
    aviso.innerHTML = html;
    aviso.addEventListener("click", async () => {
      aviso.remove();
      const { irA } = await import("../navegacion.js");
      irA("logros");
    });
    setTimeout(() => caja.appendChild(aviso), i * 400);
    setTimeout(() => aviso.classList.add("saliendo"), 5000 + i * 400);
    setTimeout(() => aviso.remove(), 5600 + i * 400);
  });
}
