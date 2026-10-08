import { copiaProfunda } from "../comun/utilidades.js";
import { leer, escribir } from "../comun/almacen.js";

// NO cambiar estas claves: si se cambian, se pierden los equipos guardados
const CLAVE_EQUIPO = "poketeams-equipo-v1";
const CLAVE_GUARDADOS = "poketeams-equipos-v1";
const CLAVE_ACTUAL = "poketeams-actual-v1";
const CLAVE_ORDEN_MANUAL = "poketeams-equipos-orden-v1";

export const MAX_EQUIPO = 6;

// Equipo que se está editando. Es un objeto para que todos los módulos vean los cambios.
export const estado = {
  equipo: [], // los Pokémon del equipo actual
  nombre: "",
  id: null    // id en «Mis equipos» (null si todavía no se ha guardado)
};

// ---------- Equipo actual ----------

export function cargarEstado() {
  estado.equipo = leer(CLAVE_EQUIPO, []);
  const actual = leer(CLAVE_ACTUAL, null);
  estado.nombre = (actual && actual.nombre) || "";
  estado.id = (actual && actual.id) || null;
  ordenarPorFechaUnaVez();
}

export function guardarEquipo() {
  escribir(CLAVE_EQUIPO, estado.equipo);
}

export function guardarActual() {
  escribir(CLAVE_ACTUAL, { nombre: estado.nombre, id: estado.id });
}

export function reemplazarEquipo(pokemon, nombre, id) {
  estado.equipo = pokemon;
  estado.nombre = nombre;
  estado.id = id;
  guardarEquipo();
  guardarActual();
}

// ---------- Equipos guardados ----------

export function leerGuardados() {
  return leer(CLAVE_GUARDADOS, []);
}

export function escribirGuardados(lista) {
  return escribir(CLAVE_GUARDADOS, lista);
}

// Coloca los equipos guardados en el orden de esos ids (el usuario los ha arrastrado)
export function reordenarGuardados(ids) {
  const porId = new Map(leerGuardados().map((g) => [g.id, g]));
  escribirGuardados(ids.map((id) => porId.get(id)).filter(Boolean));
}

// Antes «Mis equipos» se ordenaba siempre por fecha. Ahora manda el orden guardado:
// la primera vez se guarda el orden por fecha que se veía, para que no cambie nada.
function ordenarPorFechaUnaVez() {
  if (leer(CLAVE_ORDEN_MANUAL, false)) return;
  escribirGuardados(leerGuardados().sort((a, b) => b.actualizado - a.actualizado));
  escribir(CLAVE_ORDEN_MANUAL, true);
}

function nombreParaGuardar() {
  return estado.nombre.trim() || "Equipo sin nombre";
}

// Las stats, descripciones y datos de combate se descargan solos al pasar el ratón:
// no cuentan como un cambio del usuario
const DATOS_AUTOMATICOS = new Set(["stats", "descripcion", "fuente", "potencia", "precision", "categoria"]);

function sinStats(clave, valor) {
  return DATOS_AUTOMATICOS.has(clave) ? undefined : valor;
}

export function hayCambiosSinGuardar() {
  if (estado.equipo.length === 0) return false;
  const guardado = leerGuardados().find((g) => g.id === estado.id);
  if (!guardado) return true;
  return (
    JSON.stringify(guardado.pokemon, sinStats) !== JSON.stringify(estado.equipo, sinStats) ||
    guardado.nombre !== nombreParaGuardar()
  );
}

// Guarda el equipo actual en «Mis equipos». Devuelve false si el navegador no lo permite.
export function guardarEnMisEquipos() {
  const guardados = leerGuardados();
  const existente = guardados.find((g) => g.id === estado.id);

  if (existente) {
    existente.nombre = nombreParaGuardar();
    existente.pokemon = copiaProfunda(estado.equipo);
    existente.actualizado = Date.now();
  } else {
    estado.id = String(Date.now());
    guardados.unshift({ // los equipos nuevos salen los primeros
      id: estado.id,
      nombre: nombreParaGuardar(),
      pokemon: copiaProfunda(estado.equipo),
      actualizado: Date.now()
    });
  }

  const ok = escribirGuardados(guardados);
  guardarActual();
  return ok;
}
