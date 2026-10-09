// ---------- Juegos propios ----------
//
// Para jugar a algo que no está en la web (un fan game) o con level caps distintos: cada uno
// se crea los suyos, con sus lugares (Rutas) y sus combates (Level caps). Se pueden empezar
// en blanco o copiando uno de la web. Se guardan como los equipos (en el navegador y, con
// sesión, en tu cuenta).
//
//   { id: "propio-...", nombre, base (id del juego de la web del que se copió, o ""),
//     secciones: [{ titulo, lugares: ["Ruta 1", ...] }],
//     combates: [{ etiqueta, nombre, lugar, nivel, tipo, seccion? }],
//     actualizado, recibido (true si llegó de un locke de otro) }
//
// Un locke puede ser de un juego propio: se guarda una COPIA en el locke (locke.juegoPropio),
// y quien lo acepta la recibe en los suyos, para poder abrir sus Rutas y sus Level caps. Si
// quien lo creó lo cambia, se actualiza en sus lockes y, de ahí, en los de los demás (solo
// en las copias recibidas: lo que es tuyo no lo pisa nadie).
//
//   localStorage «poketeams-juegos-propios-v1»: { juegos: [...], quitados: [id] }

import { leer, escribir } from "./almacen.js";

const CLAVE = "poketeams-juegos-propios-v1";
export const PREFIJO = "propio-";

const oyentes = new Set();

function guardado() {
  const valor = leer(CLAVE, null);
  return {
    juegos: (valor && Array.isArray(valor.juegos) && valor.juegos) || [],
    quitados: (valor && valor.quitados) || []
  };
}

function guardar(estado) {
  escribir(CLAVE, estado);
  for (const funcion of oyentes) funcion();
}

export function alCambiarJuegosPropios(funcion) {
  oyentes.add(funcion);
  return () => oyentes.delete(funcion);
}

export function esPropio(id) {
  return String(id || "").startsWith(PREFIJO);
}

export function juegosPropios() {
  return guardado().juegos;
}

export function juegoPropio(id) {
  return juegosPropios().find((juego) => juego.id === id) || null;
}

// ---------- Para Rutas y Level caps ----------

// Con la forma de js/rutas/datos.js: { apartados: [{ clave, titulo }], s0: [...], s1: [...] }
export function lugaresDe(juego) {
  const lugares = { apartados: [] };
  (juego.secciones || []).forEach((seccion, indice) => {
    const clave = `s${indice}`;
    lugares.apartados.push({ clave, titulo: seccion.titulo || "Lugares" });
    lugares[clave] = seccion.lugares || [];
  });
  return lugares;
}

// El tipo de combate (para el color y los tramos de Alto Mando y Campeón) sale del nombre
export function tipoDeCombate(etiqueta) {
  const texto = String(etiqueta || "").toLowerCase();
  if (texto.includes("alto mando")) return "alto-mando";
  if (texto.includes("campe")) return "campeon";
  if (texto.includes("gimnasio") || texto.includes("líder") || texto.includes("lider")) return "gimnasio";
  return "historia";
}

// ---------- Escribir ----------

function nuevoId() {
  return `${PREFIJO}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function limpio(juego) {
  return {
    id: juego.id,
    nombre: String(juego.nombre || "").trim() || "Juego",
    base: juego.base || "",
    secciones: (juego.secciones || [])
      .map((seccion) => ({
        titulo: String(seccion.titulo || "").trim(),
        lugares: (seccion.lugares || []).map((lugar) => String(lugar).trim()).filter(Boolean)
      }))
      .filter((seccion) => seccion.lugares.length),
    combates: (juego.combates || [])
      .filter((combate) => combate && (combate.etiqueta || combate.nombre))
      .map((combate) => {
        const limpioCombate = {
          etiqueta: String(combate.etiqueta || "").trim(),
          nombre: String(combate.nombre || "").trim(),
          lugar: String(combate.lugar || "").trim(),
          nivel: Math.max(1, Math.min(100, Math.round(Number(combate.nivel) || 1))),
          tipo: combate.tipo || tipoDeCombate(combate.etiqueta)
        };
        if (combate.seccion) limpioCombate.seccion = combate.seccion;
        if (combate.aprox) limpioCombate.aprox = true;
        return limpioCombate;
      }),
    actualizado: Date.now()
  };
}

export function nombreLibre(nombre, salvoId = null) {
  const clave = String(nombre || "").trim().toLowerCase();
  return !juegosPropios().some((juego) => juego.id !== salvoId && juego.nombre.trim().toLowerCase() === clave);
}

// Crea (sin id) o cambia (con id) uno de los tuyos. Devuelve cómo ha quedado.
export function guardarJuegoPropio(juego) {
  const estado = guardado();
  const nuevo = limpio({ ...juego, id: juego.id || nuevoId() });
  const posicion = estado.juegos.findIndex((cada) => cada.id === nuevo.id);
  if (posicion >= 0) estado.juegos[posicion] = nuevo; // al cambiarlo pasa a ser tuyo
  else estado.juegos.push(nuevo);
  guardar(estado);
  return nuevo;
}

export function borrarJuegoPropio(id) {
  const estado = guardado();
  estado.juegos = estado.juegos.filter((juego) => juego.id !== id);
  if (!estado.quitados.includes(id)) estado.quitados.push(id);
  guardar(estado);
}

// ---------- Lockes ----------

// Lo que se guarda en un locke
export function copiaParaLocke(id) {
  const juego = juegoPropio(id);
  if (!juego) return null;
  const { recibido, ...copia } = juego;
  return copia;
}

// El de un locke aceptado: si no lo tienes, se apunta; si lo tienes porque te llegó de un
// locke y este es más nuevo, se pone al día. Los tuyos y los que borraste, ni se tocan.
export function recibirJuego(copia) {
  if (!copia || !esPropio(copia.id)) return false;
  const estado = guardado();
  if (estado.quitados.includes(copia.id)) return false;

  const posicion = estado.juegos.findIndex((juego) => juego.id === copia.id);
  if (posicion >= 0) {
    const actual = estado.juegos[posicion];
    if (!actual.recibido || (actual.actualizado || 0) >= (copia.actualizado || 0)) return false;
    estado.juegos[posicion] = { ...limpio(copia), actualizado: copia.actualizado, recibido: true };
  } else {
    estado.juegos.push({ ...limpio(copia), actualizado: copia.actualizado || Date.now(), recibido: true });
  }
  guardar(estado);
  return true;
}
