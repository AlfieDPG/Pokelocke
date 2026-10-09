// Sección «Level caps»: combates importantes de cada juego con el nivel máximo permitido.
// Los combates de cada juego están en ./datos.js; los de los juegos propios, en cada uno
// (js/comun/juegos-propios.js), y se cambian con «Editar juego».

import { COMBATES } from "./datos.js";
import { crearSelectorJuego } from "../comun/selector-juego.js";
import { leer, escribir } from "../comun/almacen.js";
import { imagenConRespaldo, urlSpritePixel } from "../comun/imagenes.js";
import { escaparHTML } from "../comun/utilidades.js";
import { abrirEditorJuego } from "../comun/editor-juego.js";

// ---------- Retratos de los entrenadores ----------
//
// Sprites de Pokémon Showdown. Se usa el nombre «a secas», que es el dibujo más reciente
// que tienen de cada uno (en los juegos nuevos ya es en alta resolución). Solo se pone el
// sufijo de generación en los que no existe sin él.
//
// Un combate sin entrada aquí simplemente sale sin foto: pasa con los Pokémon dominantes
// de Alola, con los campeones genéricos y con los personajes inventados de Pokémon Añil.

const URL_ENTRENADORES = "https://play.pokemonshowdown.com/sprites/trainers/";

const KANTO = {
  "Brock": "brock", "Misty": "misty", "Teniente Surge": "ltsurge", "Erika": "erika",
  "Koga": "koga", "Sabrina": "sabrina", "Blaine": "blaine", "Giovanni": "giovanni",
  "Lorelei": "lorelei-gen3", "Bruno": "bruno", "Agatha": "agatha-gen3",
  "Lance": "lance", "Azul": "blue"
};

const SINNOH = {
  "Roco": "roark", "Gardenia": "gardenia", "Brega": "maylene", "Mananti": "crasherwake",
  "Fantina": "fantina", "Acerón": "byron", "Inverna": "candice", "Lectro": "volkner",
  "Alecrán": "aaron", "Gaia": "bertha", "Fausto": "flint", "Delos": "lucian",
  "Cintia": "cynthia"
};

const UNOVA_ALTO_MANDO = {
  "Anís": "shauntal", "Lotto": "grimsley", "Catleya": "caitlin", "Marshal": "marshal"
};

// Los Pokémon dominantes no son entrenadores: se usa su sprite de la forma dominante
// («pokemon:10121» es gumshoos-totem). Cuando la prueba cambia según la versión
// (Sol/Luna) se pone el de la primera.
const ALOLA = {
  "Kahuna Hala": "hala", "Kahuna Mayla": "olivia", "Kahuna Denio": "nanu",
  "Kahuna Hela": "hapu", "Kukui": "kukui",

  // Alto Mando (Hala y Mayla salen también antes como kahunas, con otro nombre)
  "Hala": "hala", "Mayla": "olivia", "Zarala": "acerola", "Kahili": "kahili",

  "Gumshoos / Raticate dominante": "pokemon:10121",
  "Lurantis dominante": "pokemon:10128",
  "Mimikyu dominante": "pokemon:10144",
  "Kommo-o dominante": "pokemon:10146"
};

const RETRATOS = {
  frlg: KANTO,

  // Fangame: los líderes de Kanto y los de Hoenn que aparecen de visita.
  // Urano y Sachiko son personajes propios y no tienen sprite.
  anil: {
    ...KANTO,
    "Koga y Sachiko": "koga",
    "Urano": "local:urano", // personaje propio de Añil: hay que poner la imagen a mano
    "Norman": "norman", "Candela": "flannery", "Alana": "winona", "Erico": "wattson",
    "Petra": "roxanne", "Marcial": "brawly", "Plubio": "wallace", "Vito y Leti": "tateandliza-gen6"
  },

  hgss: {
    "Pegaso": "falkner", "Antón": "bugsy", "Blanca": "whitney", "Morti": "morty",
    "Aníbal": "chuck", "Yasmina": "jasmine", "Fredo": "pryce", "Débora": "clair",
    "Mento": "will", "Koga": "koga", "Bruno": "bruno", "Karen": "karen", "Lance": "lance"
  },

  oras: {
    "Petra": "roxanne", "Marcial": "brawly", "Erico": "wattson", "Candela": "flannery",
    "Norman": "norman", "Alana": "winona", "Vito y Leti": "tateandliza-gen6", "Plubio": "wallace",
    "Sixto": "sidney", "Fátima": "phoebe-gen6", "Nívea": "glacia", "Dracón": "drake-gen3",
    "Máximo": "steven"
  },

  dp: SINNOH,
  bdsp: SINNOH,
  platino: SINNOH,

  bw: {
    "Millo / Maíz / Zeo": "cilan", "Aloe": "lenora", "Camus": "burgh", "Camila": "elesa",
    "Yakón": "clay", "Gerania": "skyla", "Junco": "brycen", "Lirio / Iris": "drayden",
    ...UNOVA_ALTO_MANDO,
    "N": "n", "Ghechis": "ghetsis", "Mirto (Campeón)": "alder"
  },

  b2w2: {
    "Cheren": "cheren", "Hiedra": "roxie", "Camus": "burgh", "Camila": "elesa",
    "Yakón": "clay", "Gerania": "skyla", "Lirio": "drayden", "Ciprián": "marlon",
    ...UNOVA_ALTO_MANDO,
    "Iris": "iris"
  },

  xy: {
    "Violeta": "viola", "Lino": "grant", "Corelia": "korrina", "Amaro": "ramos",
    "Lem": "clemont", "Valeria": "valerie", "Ástrid": "olympia", "Édel": "wulfric",
    "Malva": "malva", "Tileo": "siebold", "Narciso": "wikstrom", "Drácena": "drasna",
    "Dianta": "diantha"
  },

  sm: {
    ...ALOLA,
    "Wishiwashi dominante": "pokemon:10127",
    "Salazzle / Marowak dominante": "pokemon:10129",
    "Vikavolt dominante": "pokemon:10122"
  },

  usum: {
    ...ALOLA,
    "Profesora Emily": "teacher",
    "Tilo": "hau",
    "Araquanid dominante": "pokemon:10153",
    "Marowak dominante": "pokemon:10149",
    "Togedemaru dominante": "pokemon:10154",
    "Ribombee dominante": "pokemon:10150",
    "Ultra Necrozma": "pokemon:10157"
  },

  swsh: {
    "Percy": "milo", "Cathy": "nessa", "Naboru": "kabu", "Judith / Alistair": "bea",
    "Sally": "opal", "Morris / Mel": "gordie", "Nerio": "piers", "Roy": "raihan",
    "Roxy": "marnie", "Paul": "hop", "Berto": "bede", "Lionel": "leon"
  }
};

// Tres orígenes según cómo empiece el valor del mapa:
//   "local:urano"   -> img/entrenadores/urano.png (personajes propios de los fangames)
//   "pokemon:10121" -> sprite de ese Pokémon (los dominantes de Alola)
//   lo demás        -> sprite de entrenador de Showdown
// Si la imagen no existe, la foto no sale y el combate se ve como antes.
function urlRetrato(archivo) {
  if (archivo.startsWith("local:")) return `img/entrenadores/${archivo.slice("local:".length)}.png`;
  if (archivo.startsWith("pokemon:")) return urlSpritePixel(archivo.slice("pokemon:".length));
  return `${URL_ENTRENADORES}${archivo}.png`;
}

function retrato(c) {
  // Un juego propio copiado de uno de la web usa los retratos de aquel
  const delJuego = RETRATOS[juego.propio ? juego.base : juego.id];
  const archivo = delJuego && delJuego[c.nombre];
  if (!archivo) return "";

  return imagenConRespaldo(
    [urlRetrato(archivo)],
    `class="cap-retrato" alt="" loading="lazy" data-quitar-si-falla`
  );
}

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
const editar = vista.querySelector(".juego-editar");

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

  if (!combates.length) {
    resumen.innerHTML = "";
    return;
  }
  if (!siguiente) {
    resumen.innerHTML = "¡Has superado todos los combates de este juego!";
    return;
  }
  resumen.innerHTML = `
    <span>Tu level cap ahora:</span>
    <strong class="caps-nivel-grande">${textoNivel(siguiente)}</strong>
    <span>antes de ${escaparHTML([siguiente.etiqueta.toLowerCase(), siguiente.nombre].filter(Boolean).join(" · "))}</span>
  `;
}

// Todo escapado: los juegos propios los escribe la gente
function filaCombate(c) {
  const clave = claveCombate(c);
  const hecho = superados.has(clave);
  return `
    <li class="cap ${escaparHTML(c.tipo)} ${hecho ? "superado" : ""}">
      <label>
        <input type="checkbox" data-clave="${escaparHTML(clave)}" ${hecho ? "checked" : ""}>
        ${retrato(c)}
        <span class="cap-etiqueta">${escaparHTML(c.etiqueta)}</span>
        <span class="cap-nombre">${escaparHTML(c.nombre)}</span>
        ${c.lugar ? `<span class="cap-lugar">${escaparHTML(c.lugar)}</span>` : ""}
      </label>
      <span class="cap-nivel" ${tituloNivel(c)}>Nv. ${textoNivel(c)}</span>
    </li>`;
}

// Tramos que llevan su propio título dentro de la lista, al llegar el primer combate de ese tipo
const TRAMOS = { "alto-mando": "Alto Mando", campeon: "Campeón" };

function pintarLista() {
  if (!combates.length) {
    lista.innerHTML = `<li class="caps-vacio">Este juego no tiene combates. Añádelos con «Editar juego».</li>`;
    pintarResumen();
    return;
  }

  // Primero los combates normales y después, con su título, los de cada sección aparte
  let html = "";
  let tipoAnterior = null;

  for (const c of combates.filter((c) => !c.seccion)) {
    if (TRAMOS[c.tipo] && c.tipo !== tipoAnterior) {
      html += `<li class="caps-tramo ${c.tipo}"><h3>${TRAMOS[c.tipo]}</h3></li>`;
    }
    tipoAnterior = c.tipo;
    html += filaCombate(c);
  }

  const secciones = [...new Set(combates.filter((c) => c.seccion).map((c) => c.seccion))];
  for (const seccion of secciones) {
    html += `<li class="caps-seccion"><h3>${escaparHTML(seccion)}</h3></li>`;
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

  // Juegos propios: crear uno (desde «Tus juegos») y cambiar el abierto
  const abrirEnElSelector = (guardado) => selectorJuego.elegirPorId(guardado.id);
  editar.addEventListener("click", () => abrirEditorJuego(juego.id, abrirEnElSelector));

  selectorJuego = crearSelectorJuego(selector, CLAVE_JUEGO, elegirJuego, () => abrirEditorJuego(null, abrirEnElSelector));
}

let selectorJuego = null;

function elegirJuego(nuevo) {
  juego = nuevo;
  combates = (juego.propio ? juego.combates : COMBATES[juego.id]) || [];
  editar.hidden = !juego.propio;
  superados = new Set(guardados[juego.id] || []);
  multiplicador = multiplicadores[juego.id] || 1;
  pintarMultiplicador();
  pintarLista();
}

export function mostrar() {
  // Si se ha llegado desde un locke de «Versus», el juego viene apuntado en CLAVE_JUEGO.
  // Si es el mismo que ya había, no hace nada.
  selectorJuego.elegirPorId(leer(CLAVE_JUEGO, null));
}
