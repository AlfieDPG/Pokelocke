// ---------- Lockes compartidos (sección «Versus») ----------
//
// Un locke es una partida entre varios: su marcador, sus vidas y quién acabó ganando.
// Vive entero en Firestore porque es un dato de dos personas a la vez; si cada navegador
// guardase su copia volvería el problema de quién pisa a quién.
//
// Está escuchado en vivo (onSnapshot): si tu rival quita una vida desde su móvil, a ti te
// cambia en pantalla al momento.
//
// Documento (lockes/{id}), reglas en firestore.rules:
//
//   { nombre, descripcion, tipo: {id,nombre,color}, juego, juegoOtro,
//     jugadores: [uid],            // todos los metidos, invitados incluidos
//     estados: {uid: "aceptado"|"pendiente"},
//     nombres: {uid}, fotos: {uid}, creador,
//     vidasIniciales, vidasIlimitadas, vidas: {uid:n}, marcador: {uid:n},
//     estado: "abierto"|"cerrado", ganador, fechaFin: "2025-06-01",
//     contado: [uid], creado, actualizado }
//
// Quién puede tocar qué (lo hacen cumplir las reglas, no solo la pantalla):
//   · tus vidas, tus victorias y tu estado: solo tú
//   · nombre, tipo, juego, ganador y cerrarlo: solo quien lo creó
//   · invitar: cualquiera de dentro
//
// Los nombres y las fotos se copian dentro del locke a propósito: así se pinta de una sola
// lectura y sigue saliendo bien aunque luego dejéis de ser amigos.
//
// «jugadores» lleva también a los invitados que no han contestado: si no, las reglas no les
// dejarían ni leer la invitación. Quién ha aceptado está en «estados».

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { apuntarLockesGanados } from "./perfiles.js";
import { hoyComoTexto } from "./utilidades.js";

let todos = [];
let dejarDeEscuchar = null;
let fallo = "";
const oyentes = new Set();

// ---------- Leer ----------

export function lockes() {
  return todos;
}

// Los que ya has aceptado: los que se enseñan en «Versus»
export function misLockes() {
  return todos.filter((locke) => miEstado(locke) === "aceptado");
}

// Los que te han propuesto y no has contestado
export function invitacionesALockes() {
  return todos.filter((locke) => miEstado(locke) === "pendiente");
}

export function miEstado(locke) {
  const usuario = usuarioActual();
  if (!usuario) return "";
  // Los lockes creados antes de que hubiera invitaciones no tienen «estados»
  return (locke.estados || {})[usuario.uid] || "aceptado";
}

export function estadoDe(locke, uid) {
  return (locke.estados || {})[uid] || "aceptado";
}

export function fallaLosLockes() {
  return fallo;
}

export function alCambiarLockes(funcion) {
  oyentes.add(funcion);
  funcion(todos);
  return () => oyentes.delete(funcion);
}

function avisar() {
  for (const funcion of oyentes) funcion(todos);
}

// ---------- Arranque ----------

export function iniciarLockes() {
  alCambiarSesion((usuario) => {
    if (dejarDeEscuchar) {
      dejarDeEscuchar();
      dejarDeEscuchar = null;
    }

    todos = [];
    fallo = "";

    if (!usuario) {
      avisar();
      return;
    }

    escuchar(usuario);
  });
}

function escuchar(usuario) {
  const { bd, fn } = baseDeDatos();

  dejarDeEscuchar = fn.onSnapshot(
    fn.query(fn.collection(bd, "lockes"), fn.where("jugadores", "array-contains", usuario.uid)),
    (instantanea) => {
      fallo = "";
      todos = instantanea.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
      avisar();

      // Si alguien ha cerrado un locke que he ganado, el +1 me lo apunto yo. Se mira aquí
      // antes de llamar para no lanzar una consulta en cada clic del marcador.
      const sinApuntar = todos.some(
        (locke) =>
          locke.estado === "cerrado" &&
          locke.ganador === usuario.uid &&
          !(locke.contado || []).includes(usuario.uid)
      );
      if (sinApuntar) apuntarLockesGanados().catch((error) => console.error(error));
    },
    (error) => {
      console.error("No se han podido leer los lockes", error);
      fallo =
        error.code === "permission-denied"
          ? "Firebase no deja leer los lockes. Falta publicar las reglas de Firestore."
          : "No se han podido cargar los lockes.";
      avisar();
    }
  );
}

// ---------- Escribir ----------

function referencia(id) {
  const { bd, fn } = baseDeDatos();
  return { fn, ref: fn.doc(bd, "lockes", id) };
}

export function lockePorId(id) {
  return todos.find((locke) => locke.id === id) || null;
}

// «invitados» puede venir vacío: un locke para ti solo es perfectamente válido, y luego
// siempre se puede meter gente.
export async function crearLocke({
  nombre, descripcion, tipo, juego, juegoOtro, vidas, vidasIlimitadas, invitados, nombres, fotos
}) {
  const usuario = usuarioActual();
  const { bd, fn } = baseDeDatos();

  const jugadores = [usuario.uid, ...invitados];
  const estados = { [usuario.uid]: "aceptado" };
  const porJugador = { vidas: {}, marcador: {} };

  for (const uid of invitados) estados[uid] = "pendiente";
  for (const uid of jugadores) {
    porJugador.vidas[uid] = vidasIlimitadas ? 0 : vidas;
    porJugador.marcador[uid] = 0;
  }

  await fn.addDoc(fn.collection(bd, "lockes"), {
    nombre,
    descripcion: descripcion || "",
    tipo,
    juego: juego || "",
    juegoOtro: juegoOtro || "",
    jugadores,
    estados,
    nombres,
    fotos,
    creador: usuario.uid,
    vidasIniciales: vidasIlimitadas ? 0 : vidas,
    vidasIlimitadas: Boolean(vidasIlimitadas),
    vidas: porJugador.vidas,
    marcador: porJugador.marcador,
    estado: "abierto",
    ganador: "",
    fechaFin: "",
    contado: [],
    creado: Date.now(),
    actualizado: Date.now()
  });
}

// Solo tus propias vidas y victorias: las de los demás las cambia cada uno desde su cuenta
// (y las reglas de Firestore rechazarían lo contrario).
export async function cambiarNumero(id, uid, campo, cuanto) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || locke.estado === "cerrado" || !usuario || uid !== usuario.uid) return;

  const actual = (locke[campo] || {})[uid] || 0;
  const nuevo = Math.max(0, Math.min(999, actual + cuanto));
  if (nuevo === actual) return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, { [`${campo}.${uid}`]: nuevo, actualizado: Date.now() });
}

// Solo quien creó el locke elige ganador. Se apunta el día, que luego sale en la ficha.
export async function elegirGanador(id, uid) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.creador !== usuario.uid) return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    estado: "cerrado",
    ganador: uid,
    fechaFin: hoyComoTexto(),
    actualizado: Date.now()
  });
  await apuntarLockesGanados();
}

export function soyCreador(locke) {
  const usuario = usuarioActual();
  return Boolean(usuario && locke && locke.creador === usuario.uid);
}

// Mete a más gente en un locke que ya está en marcha. Entran como «pendiente», con las
// mismas vidas con las que empezó el locke y el marcador a 0, y les llega al buzón.
// «vidasDePartida»: solo si se acaban de cambiar en la misma ventana y el locke que tenemos
// en memoria todavía no lo refleja.
export async function invitarALocke(id, perfiles, vidasDePartida) {
  const locke = lockePorId(id);
  if (!locke || locke.estado === "cerrado" || !perfiles.length) return;

  const { fn, ref } = referencia(id);
  const vidas =
    vidasDePartida !== undefined ? vidasDePartida : locke.vidasIlimitadas ? 0 : locke.vidasIniciales || 0;

  const cambios = {
    jugadores: fn.arrayUnion(...perfiles.map((perfil) => perfil.uid)),
    actualizado: Date.now()
  };

  for (const perfil of perfiles) {
    cambios[`estados.${perfil.uid}`] = "pendiente";
    cambios[`nombres.${perfil.uid}`] = perfil.nombre;
    cambios[`fotos.${perfil.uid}`] = perfil.foto || "";
    cambios[`vidas.${perfil.uid}`] = vidas;
    cambios[`marcador.${perfil.uid}`] = 0;
  }

  await fn.updateDoc(ref, cambios);
}

export async function borrarLocke(id) {
  const { fn, ref } = referencia(id);
  await fn.deleteDoc(ref);
}

// Al entrar, tus vidas son las que tenga el locke AHORA: el creador puede haberlas cambiado
// desde que te invitó (mientras nadie más haya empezado a jugar).
export async function aceptarLocke(id) {
  const usuario = usuarioActual();
  const locke = lockePorId(id);
  const { fn, ref } = referencia(id);

  const cambios = {
    [`estados.${usuario.uid}`]: "aceptado",
    actualizado: Date.now()
  };
  if (locke) cambios[`vidas.${usuario.uid}`] = locke.vidasIlimitadas ? 0 : locke.vidasIniciales || 0;

  await fn.updateDoc(ref, cambios);
}

// Las vidas de partida solo se pueden cambiar mientras nadie más haya aceptado: después ya
// hay gente jugando con las suyas, y sus vidas solo las toca cada uno.
export function sePuedenCambiarVidas(locke) {
  const usuario = usuarioActual();
  return (locke.jugadores || []).every(
    (uid) => uid === usuario.uid || estadoDe(locke, uid) === "pendiente"
  );
}

// Solo quien lo creó. Cambia los datos del principio (nombre, tipo, juego, descripción y,
// si todavía se puede, las vidas); las suyas propias se ponen a las nuevas de partida.
export async function editarLocke(id, datos) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario || locke.creador !== usuario.uid) return;

  const cambios = {
    nombre: datos.nombre,
    descripcion: datos.descripcion || "",
    tipo: datos.tipo,
    juego: datos.juego || "",
    juegoOtro: datos.juegoOtro || "",
    actualizado: Date.now()
  };

  const vidasCambian =
    Boolean(datos.vidasIlimitadas) !== Boolean(locke.vidasIlimitadas) ||
    (!datos.vidasIlimitadas && datos.vidas !== locke.vidasIniciales);

  if (vidasCambian && sePuedenCambiarVidas(locke)) {
    cambios.vidasIlimitadas = Boolean(datos.vidasIlimitadas);
    cambios.vidasIniciales = datos.vidasIlimitadas ? 0 : datos.vidas;
    cambios[`vidas.${usuario.uid}`] = cambios.vidasIniciales;
  }

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, cambios);
}

// Rechazar es salirse: se quita el uid de «jugadores» y, en cuanto deja de estar, el
// documento ya no aparece en tu consulta ni te deja leerlo (así lo dicen las reglas).
// Echar a alguien que todavía no ha contestado. «quitado» va en la misma escritura para que
// las reglas sepan a quién se quita y comprueben que seguía pendiente. Al salir de
// «jugadores» deja de ver el locke, y con él su notificación.
export async function quitarDeLocke(id, uid) {
  const locke = lockePorId(id);
  if (!locke || estadoDe(locke, uid) !== "pendiente") return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    jugadores: fn.arrayRemove(uid),
    quitado: uid,
    [`estados.${uid}`]: fn.deleteField(),
    [`vidas.${uid}`]: fn.deleteField(),
    [`marcador.${uid}`]: fn.deleteField(),
    actualizado: Date.now()
  });
}

export async function rechazarLocke(id) {
  const usuario = usuarioActual();
  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    jugadores: fn.arrayRemove(usuario.uid),
    [`estados.${usuario.uid}`]: fn.deleteField(),
    [`vidas.${usuario.uid}`]: fn.deleteField(),
    [`marcador.${usuario.uid}`]: fn.deleteField(),
    actualizado: Date.now()
  });
}
