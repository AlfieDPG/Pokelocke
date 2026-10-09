// ---------- Copia en la nube (Firebase) ----------
//
// Cómo funciona:
//   · El navegador sigue mandando: leer() y escribir() no cambian y siguen siendo inmediatos.
//   · Al iniciar sesión se comparan las fechas de cada clave. Para cada una gana la más
//     reciente, venga del navegador o de la nube. Si algo cambia, se recarga la página
//     para que todas las secciones se vuelvan a pintar con los datos buenos.
//   · A partir de ahí, cada vez que se guarda algo se sube en segundo plano (con un
//     respiro de un segundo para no subir diez veces seguidas al arrastrar o escribir).
//
// Cada clave va en su propio documento (usuarios/{uid}/datos/{clave}) para no toparse
// con el límite de 1 MiB por documento de Firestore cuando haya muchos equipos.

import { CONFIG_FIREBASE, hayConfiguracion } from "./firebase-config.js";
import {
  CLAVES_SINCRONIZADAS, leer, escribir, tiempos, alCambiar, escribirDesdeLaNube, vaciarSincronizadas
} from "./almacen.js";

// De quién son los datos que hay ahora mismo en este navegador
const CLAVE_DUENO = "poketeams-dueno-v1";

const VERSION_SDK = "11.3.1";
const BASE_SDK = `https://www.gstatic.com/firebasejs/${VERSION_SDK}/`;

const RETRASO_SUBIDA = 1000; // ms que se espera antes de subir, por si vienen más cambios

let auth = null;
let bd = null;
let usuario = null;
let funcionesAuth = null;
let funcionesBD = null;

const pendientes = new Set();
let temporizador = null;

// ---------- Carga del SDK ----------

// Se descarga solo si hay configuración y solo la primera vez
async function cargarFirebase() {
  const [app, autenticacion, firestore] = await Promise.all([
    import(`${BASE_SDK}firebase-app.js`),
    import(`${BASE_SDK}firebase-auth.js`),
    import(`${BASE_SDK}firebase-firestore.js`)
  ]);

  const aplicacion = app.initializeApp(CONFIG_FIREBASE);
  funcionesAuth = autenticacion;
  funcionesBD = firestore;
  auth = autenticacion.getAuth(aplicacion);
  bd = abrirFirestore(firestore, aplicacion);
}

// Con caché en el navegador (IndexedDB): al entrar, perfiles, amistades y lockes salen al
// momento con lo de la última vez y se ponen al día en cuanto contesta el servidor. Vale
// también con la web abierta en varias pestañas. Si el navegador no deja (modo incógnito
// en algunos), se usa la de siempre, solo en memoria.
function abrirFirestore(firestore, aplicacion) {
  try {
    return firestore.initializeFirestore(aplicacion, {
      localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() })
    });
  } catch (error) {
    console.error("Firestore sin caché local", error);
    return firestore.getFirestore(aplicacion);
  }
}

// ---------- Subir y bajar ----------

function documento(clave) {
  return funcionesBD.doc(bd, "usuarios", usuario.uid, "datos", clave);
}

async function subir(clave) {
  const valor = leer(clave, null);
  // Lo guardado antes de que existiera la nube no tiene fecha: se le pone ahora y se deja
  // apuntada también aquí, para que al volver a entrar no parezca que la nube es más nueva.
  const cuando = tiempos()[clave] || Date.now();
  escribirDesdeLaNube(clave, valor, cuando);

  await funcionesBD.setDoc(documento(clave), { valor: JSON.stringify(valor), actualizado: cuando });
}

// El valor va como texto: así Firestore no se queja de los arrays dentro de arrays
// ni cambia los tipos por el camino.
function valorDe(datos) {
  try {
    return JSON.parse(datos.valor);
  } catch (error) {
    return null;
  }
}

// Junta lo del navegador con lo de la nube: para cada clave gana la fecha más reciente.
// Devuelve true si ha cambiado algo de lo que hay guardado aquí.
//
// Excepción: si este navegador lo usó otra cuenta, primero se borra lo que haya aquí y
// solo se baja lo de la nube. Así dos personas pueden usar el mismo ordenador sin que
// los equipos de una acaben en la cuenta de la otra. Lo que se usó sin haber entrado
// nunca (no hay dueño apuntado) sí se sube: es el caso de estrenar la sesión.
async function juntar() {
  const dueñoAnterior = leer(CLAVE_DUENO, null);
  const otraPersona = Boolean(dueñoAnterior) && dueñoAnterior !== usuario.uid;

  if (otraPersona) vaciarSincronizadas();
  escribir(CLAVE_DUENO, usuario.uid);

  const locales = tiempos();
  const instantanea = await funcionesBD.getDocs(
    funcionesBD.collection(bd, "usuarios", usuario.uid, "datos")
  );

  const enLaNube = new Map();
  instantanea.forEach((d) => enLaNube.set(d.id, d.data()));

  let hayCambios = false;
  const porSubir = [];

  for (const clave of CLAVES_SINCRONIZADAS) {
    const remoto = enLaNube.get(clave);
    const fechaLocal = locales[clave] || 0;
    const fechaRemota = (remoto && remoto.actualizado) || 0;
    const hayAqui = leer(clave, undefined) !== undefined;

    if (remoto && fechaRemota > fechaLocal) {
      if (escribirDesdeLaNube(clave, valorDe(remoto), fechaRemota)) hayCambios = true;
    } else if (hayAqui && (!remoto || fechaLocal > fechaRemota)) {
      // También entra aquí lo que se guardó antes de que existiera la nube, que no tiene fecha
      porSubir.push(clave);
    }
  }

  await Promise.all(porSubir.map(subir));

  // Si ha entrado otra persona hay que recargar sí o sí: las secciones ya están pintadas
  // con los datos del anterior aunque la nube de la nueva esté vacía.
  return hayCambios || otraPersona;
}

// ---------- Avisos de la interfaz ----------

const oyentes = new Set();

export function alCambiarSesion(funcion) {
  oyentes.add(funcion);
  funcion(usuario);
}

function avisarDeLaSesion() {
  for (const funcion of oyentes) funcion(usuario);
}

// ---------- Entrar y salir ----------

export async function entrar() {
  if (!auth) return;
  const proveedor = new funcionesAuth.GoogleAuthProvider();
  await funcionesAuth.signInWithPopup(auth, proveedor);
}

export async function salir() {
  if (!auth) return;
  await funcionesAuth.signOut(auth);
}

export function hayNube() {
  return hayConfiguracion();
}

// ---------- Acceso directo a Firestore ----------
//
// Lo usan las partes compartidas (perfiles, amigos y lockes), que no pasan por
// localStorage: ahí no tiene sentido guardar una copia local, porque el dato es de dos
// personas a la vez y la copia volvería a plantear quién pisa a quién.
//
// Devuelve null mientras el SDK no esté cargado o no haya sesión.

export function usuarioActual() {
  return usuario;
}

export function baseDeDatos() {
  return bd ? { bd, fn: funcionesBD } : null;
}

// ---------- Arranque ----------

export async function iniciarNube() {
  if (!hayConfiguracion()) return; // sin configurar: la web va solo con el navegador

  try {
    await cargarFirebase();
  } catch (error) {
    console.error("No se ha podido cargar Firebase", error);
    return;
  }

  // Cada vez que se guarda algo se apunta para subirlo un segundo después
  alCambiar((clave) => {
    if (!usuario) return;
    pendientes.add(clave);
    clearTimeout(temporizador);
    temporizador = setTimeout(vaciarPendientes, RETRASO_SUBIDA);
  });

  funcionesAuth.onAuthStateChanged(auth, async (nuevo) => {
    usuario = nuevo;
    avisarDeLaSesion();
    if (!nuevo) return;

    try {
      if (await juntar()) location.reload(); // había datos más nuevos en la nube
    } catch (error) {
      console.error("No se han podido sincronizar los datos", error);
    }
  });
}

async function vaciarPendientes() {
  const claves = [...pendientes];
  pendientes.clear();

  try {
    await Promise.all(claves.map(subir));
  } catch (error) {
    // si falla, se vuelven a intentar en el siguiente cambio
    for (const clave of claves) pendientes.add(clave);
    console.error("No se han podido subir los cambios", error);
  }
}
