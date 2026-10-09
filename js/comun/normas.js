// ---------- Normas ----------
//
// Dos listas:
//   · Generales: las reglas básicas de cualquier Nuzlocke. Fijas, iguales para todos.
//   · Mis normas: las de cada uno. Se crean, se cambian y se borran en «Normas», y se
//     guardan como los equipos (en el navegador y, con sesión, en tu cuenta).
//
// Al crear o editar un locke se eligen cuáles valen y se guarda una COPIA dentro del locke
// (locke.normas), igual que el tipo: así cambiar luego una norma tuya no cambia las reglas
// de un locke que ya se está jugando, y tus amigos las pueden leer aunque no las tengan.
//
// Al aceptar un locke (y si luego quien lo creó le añade más), las normas suyas que no
// tengas se apuntan en las tuyas. Las que borres a mano no vuelven: se quedan en «quitadas».
//
//   localStorage «poketeams-normas-v1»: { normas: [{ id, nombre, texto }], quitadas: [id] }
//   Sin nada guardado (antes de tocar nada), «Mis normas» son NORMAS_DE_PARTIDA.

import { leer, escribir } from "./almacen.js";

const CLAVE_NORMAS = "poketeams-normas-v1";

export const NORMAS_GENERALES = [
  {
    id: "general-captura",
    nombre: "Una captura por zona",
    texto: "Solo puedes intentar capturar el primer Pokémon salvaje que encuentres en cada ruta, ciudad o zona. Si se debilita o huye, pierdes la captura de esa zona."
  },
  {
    id: "general-muerto",
    nombre: "Debilitado = muerto",
    texto: "Si un Pokémon se debilita, se considera muerto: no puedes volver a usarlo. Libéralo o déjalo para siempre en una caja «cementerio»."
  },
  {
    id: "general-motes",
    nombre: "Motes obligatorios",
    texto: "Pon mote a todos tus Pokémon, para encariñarte con ellos."
  },
  {
    id: "general-fin",
    nombre: "Fin de la partida",
    texto: "Si se debilitan todos los Pokémon de tu equipo y no te quedan Pokémon que puedas usar, has perdido el Nuzlocke."
  }
];

// Con las que empieza «Mis normas»: las que se usaban antes en la web. Se pueden borrar.
const NORMAS_DE_PARTIDA = [
  {
    id: "propia-duplicados",
    nombre: "Cláusula de duplicados",
    texto: "Si el primer Pokémon de una zona es de una especie que ya tienes, puedes pasar al siguiente Pokémon o capturarlo igualmente. Si lo capturas, no podrás usar esa segunda versión hasta que se te muera la primera."
  },
  {
    id: "propia-variocolor",
    nombre: "Cláusula variocolor",
    texto: "Los Pokémon variocolor se pueden capturar siempre, aunque no sean el primero de la zona."
  },
  {
    id: "propia-objetos",
    nombre: "Cláusula de objetos",
    texto: "No se puede repetir objeto en el equipo: dos Pokémon no pueden llevar el mismo objeto equipado."
  },
  {
    id: "propia-no-cuentan",
    nombre: "Pokémon que no cuentan como Pokémon de ruta",
    texto: "Ditto, Smeargle, Shedinja y Unown no cuentan como el Pokémon de la ruta: si te sale uno, no gastas la captura de esa zona."
  },
  {
    id: "propia-level-cap",
    nombre: "Level cap",
    texto: "Tus Pokémon no pueden superar el nivel del Pokémon más alto del siguiente combate importante (mira la sección «Level caps»)."
  },
  {
    id: "propia-fijo",
    nombre: "Estilo de combate fijo",
    texto: "Juega con el estilo de combate «Fijo»: no puedes cambiar de Pokémon gratis cuando debilitas al del rival."
  },
  {
    id: "propia-habilidades",
    nombre: "Habilidades limitadas (Randomlocke)",
    texto: "No puedes llevar en el equipo más de un Pokémon con las habilidades Amor Filial, Potencia o Energía Pura."
  },
  {
    id: "propia-tiendas",
    nombre: "Compras en tiendas especiales",
    texto: "En las tiendas especiales solo puedes comprar una unidad de cada objeto, y nunca objetos que curen PS. Las bayas sí están permitidas."
  }
];

const oyentes = new Set();

function guardado() {
  const valor = leer(CLAVE_NORMAS, null);
  return {
    normas: valor && Array.isArray(valor.normas) ? valor.normas : NORMAS_DE_PARTIDA.slice(),
    quitadas: (valor && valor.quitadas) || []
  };
}

function guardar(estado) {
  escribir(CLAVE_NORMAS, estado);
  for (const funcion of oyentes) funcion();
}

export function misNormas() {
  return guardado().normas;
}

export function esGeneral(norma) {
  return String(norma && norma.id).startsWith("general-");
}

// Avisa al cambiar «Mis normas» (también si llegan normas de un locke)
export function alCambiarNormas(funcion) {
  oyentes.add(funcion);
  return () => oyentes.delete(funcion);
}

export function nuevoIdNorma() {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Crea o, si ya existe ese id, cambia
export function guardarNorma(norma) {
  const estado = guardado();
  const limpia = { id: norma.id || nuevoIdNorma(), nombre: norma.nombre.trim(), texto: norma.texto.trim() };
  const posicion = estado.normas.findIndex((cada) => cada.id === limpia.id);
  if (posicion >= 0) estado.normas[posicion] = limpia;
  else estado.normas.push(limpia);
  guardar(estado);
  return limpia;
}

export function quitarNorma(id) {
  const estado = guardado();
  estado.normas = estado.normas.filter((norma) => norma.id !== id);
  if (!estado.quitadas.includes(id)) estado.quitadas.push(id);
  guardar(estado);
}

// Las normas de un locke que no tengas: se apuntan en las tuyas. Ni las generales (ya las
// tiene todo el mundo), ni las que ya tienes (por id o por nombre), ni las que borraste.
export function recibirNormas(lista) {
  const estado = guardado();
  const ids = new Set([...estado.normas.map((norma) => norma.id), ...estado.quitadas]);
  const nombres = new Set(estado.normas.map((norma) => norma.nombre.trim().toLowerCase()));

  const nuevas = (lista || []).filter(
    (norma) =>
      norma && norma.id && norma.nombre && !esGeneral(norma) &&
      !ids.has(norma.id) && !nombres.has(String(norma.nombre).trim().toLowerCase())
  );
  if (!nuevas.length) return 0;

  estado.normas.push(...nuevas.map(({ id, nombre, texto }) => ({ id, nombre, texto: texto || "" })));
  guardar(estado);
  return nuevas.length;
}
