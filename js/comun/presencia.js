// ---------- Quién tiene la web abierta ----------
//
// Mientras tienes la web abierta, cada minuto se apunta la hora en presencia/{tu uid}. Un
// amigo sale como conectado si su última marca es de hace menos de LIMITE. Al cerrar la
// pestaña se avisa de que te vas (si al navegador le da tiempo; si no, a los pocos minutos
// deja de salir conectado igual).
//
// Sin Realtime Database a propósito: con Firestore basta y no hay que activar nada más en
// la consola. Gasta una escritura por minuto y persona conectada, lejos del límite gratis.
//
//   presencia/{uid}  { visto: hora del servidor, conectado: true | false }

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";
import { alCambiarAmistades, amigosAceptados } from "./perfiles.js";

const CADA = 60 * 1000;          // cada cuánto se apunta la hora
const LIMITE = 3 * 60 * 1000;    // sin marca desde hace más de esto: ya no está

let temporizador = null;
let latido = null;

const presencias = new Map();    // uid -> { visto (ms), conectado }
const escuchas = new Map();      // uid -> función para dejar de escuchar
const oyentes = new Set();

// ---------- Para la pantalla ----------

export function estaConectado(uid) {
  const presencia = presencias.get(uid);
  return Boolean(presencia && presencia.conectado && Date.now() - presencia.visto < LIMITE);
}

export function alCambiarPresencia(funcion) {
  oyentes.add(funcion);
  return () => oyentes.delete(funcion);
}

function avisar() {
  for (const funcion of oyentes) funcion();
}

// ---------- Lo mío ----------

function apuntar(conectado) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;
  const { bd, fn } = acceso;
  fn.setDoc(fn.doc(bd, "presencia", usuario.uid), { visto: fn.serverTimestamp(), conectado })
    .catch((error) => console.error("No se ha podido apuntar la conexión", error));
}

function empezarAApuntar() {
  clearInterval(temporizador);
  apuntar(true);
  temporizador = setInterval(() => apuntar(true), CADA);
}

function dejarDeApuntar() {
  clearInterval(temporizador);
  temporizador = null;
}

// ---------- Lo de mis amigos ----------

function escucharAmigos() {
  const acceso = baseDeDatos();
  const quedan = new Set(usuarioActual() ? amigosAceptados().map((amistad) => amistad.otro) : []);

  for (const [uid, dejar] of escuchas) {
    if (quedan.has(uid)) continue;
    dejar();
    escuchas.delete(uid);
    presencias.delete(uid);
  }

  if (!acceso) return;
  const { bd, fn } = acceso;

  for (const uid of quedan) {
    if (escuchas.has(uid)) continue;
    escuchas.set(
      uid,
      fn.onSnapshot(
        fn.doc(bd, "presencia", uid),
        (documento) => {
          const datos = documento.data();
          if (datos && datos.visto) {
            presencias.set(uid, { visto: datos.visto.toMillis(), conectado: Boolean(datos.conectado) });
          } else {
            presencias.delete(uid);
          }
          avisar();
        },
        (error) => console.error("No se ha podido leer la conexión de un amigo", error)
      )
    );
  }
}

function dejarDeEscucharAmigos() {
  for (const dejar of escuchas.values()) dejar();
  escuchas.clear();
  presencias.clear();
}

// ---------- Arranque ----------

export function iniciarPresencia() {
  alCambiarSesion((usuario) => {
    dejarDeEscucharAmigos();
    if (usuario) {
      empezarAApuntar();
      escucharAmigos();
    } else {
      dejarDeApuntar();
    }
    avisar();
  });

  alCambiarAmistades(() => escucharAmigos());

  // Al volver a la pestaña se apunta enseguida (el navegador frena los temporizadores de
  // las pestañas de fondo) y al cerrarla se avisa de que te vas
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && temporizador) apuntar(true);
  });
  window.addEventListener("pagehide", () => apuntar(false));

  // Alguien deja de estar conectado cuando pasa el tiempo sin marca, sin que llegue nada:
  // se vuelve a mirar cada medio minuto
  clearInterval(latido);
  latido = setInterval(avisar, 30 * 1000);
}
