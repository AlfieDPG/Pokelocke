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
//     normas: { id, nombre, conGenerales, lista },  // copia del conjunto elegido (normas.js)
//     muertos: {uid: [muerto]},    // cementerio de cada uno (ver Cementerio, abajo)
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

import { usuarioActual, baseDeDatos, alCambiarSesion, cuandoEsteSincronizado } from "./nube.js";
import { apuntarLockesGanados, miPerfil, alCambiarMiPerfil } from "./perfiles.js";
import { recibirConjunto, normasDeLocke } from "./normas.js";
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

  alCambiarMiPerfil(ponerMiNombre);
}

// Cada locke guarda una copia del nombre y la foto de cada jugador. Si en alguno los míos no
// son los de mi perfil (me he cambiado el mote o la foto), los pongo al día.
// Se mira al llegar los lockes y al llegar mi perfil.
const renombrando = new Set(); // ids de lockes en los que ya se está escribiendo

function ponerMiNombre() {
  const usuario = usuarioActual();
  const perfil = miPerfil();
  const acceso = baseDeDatos();
  if (!usuario || !perfil || !perfil.mote || !acceso) return;

  const { bd, fn } = acceso;
  const foto = perfil.foto || "";
  for (const locke of todos) {
    const bien = (locke.nombres || {})[usuario.uid] === perfil.mote && ((locke.fotos || {})[usuario.uid] || "") === foto;
    if (bien || renombrando.has(locke.id)) continue;
    renombrando.add(locke.id);
    fn.updateDoc(fn.doc(bd, "lockes", locke.id), { [`nombres.${usuario.uid}`]: perfil.mote, [`fotos.${usuario.uid}`]: foto })
      .catch((error) => console.error("No se ha podido poner mi nombre en un locke", error))
      .finally(() => renombrando.delete(locke.id));
  }
}

// El conjunto de normas de los lockes que he aceptado, si no lo tengo, se apunta en los míos
// (al aceptar uno, o si quien lo creó le cambia el conjunto). Después de juntar con la nube:
// ver cuandoEsteSincronizado.
async function recibirNormasDeMisLockes() {
  await cuandoEsteSincronizado();
  for (const locke of misLockes()) recibirConjunto(normasDeLocke(locke));
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

      ponerMiNombre();
      recibirNormasDeMisLockes();
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
  nombre, descripcion, tipo, juego, juegoOtro, vidas, vidasIlimitadas, normas, invitados, nombres, fotos
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

  const nuevo = await fn.addDoc(fn.collection(bd, "lockes"), {
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
    normas: normas || null,
    estado: "abierto",
    ganador: "",
    fechaFin: "",
    contado: [],
    creado: Date.now(),
    actualizado: Date.now()
  });
  await apuntarSuceso(nuevo.id, "creado");
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
  await apuntarCambio(id, campo === "vidas" ? "vida" : "victoria", Math.sign(cuanto));
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
  await apuntarSuceso(id, "ganador", { ganador: uid });
  await apuntarLockesGanados();
}

// ---------- Cementerio ----------
//
// Los muertos de cada uno van en el propio locke, como sus vidas: muertos: { uid: [muerto] }.
// Cada uno solo toca su lista (lo comprueban las reglas).
//
//   muerto: { id, especie (número de la Pokédex), nombre (de la especie), mote, causa, fecha }

function nuevoIdMuerto() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function muertosDe(locke, uid) {
  return ((locke && locke.muertos) || {})[uid] || [];
}

// quitarVida: además se resta una vida (lo normal al darle a «−» en las vidas). Y a la
// actividad, como un solo suceso: «X ha perdido una vida: Charizard».
export async function apuntarMuerto(id, muerto, quitarVida) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario) return;

  const nuevo = {
    id: nuevoIdMuerto(),
    especie: muerto.especie,
    nombre: muerto.nombre,
    mote: muerto.mote || "",
    causa: muerto.causa || "",
    fecha: Date.now()
  };
  const cambios = {
    [`muertos.${usuario.uid}`]: [...muertosDe(locke, usuario.uid), nuevo],
    actualizado: Date.now()
  };
  const vidas = (locke.vidas || {})[usuario.uid] || 0;
  const restaVida = quitarVida && !locke.vidasIlimitadas && vidas > 0;
  if (restaVida) cambios[`vidas.${usuario.uid}`] = vidas - 1;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, cambios);

  const { especie, nombre, mote, causa } = nuevo;
  await apuntarSuceso(id, restaVida ? "vida" : "muerte", {
    ...(restaVida ? { delta: -1 } : {}),
    muerto: { especie, nombre, mote, causa }
  });
}

// Por si se apuntó mal. No devuelve la vida: eso se hace con el «+».
export async function borrarMuerto(id, idMuerto) {
  const locke = lockePorId(id);
  const usuario = usuarioActual();
  if (!locke || !usuario) return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    [`muertos.${usuario.uid}`]: muertosDe(locke, usuario.uid).filter((muerto) => muerto.id !== idMuerto),
    actualizado: Date.now()
  });
}

// ---------- Actividad ----------
//
// Lo que va pasando en un locke, para verlo en orden: lockes/{id}/actividad/{suceso}.
// Cada uno apunta solo lo suyo. Los nombres no se copian: se leen de locke.nombres al pintar.
//
//   { uid, tipo, cuando (hora del servidor), delta?, muerto?, ganador? }
//   tipo: "creado" | "entra" | "vida" | "victoria" | "muerte" | "ganador"
//
// Si apuntar falla (p. ej. faltan reglas por publicar), lo de verdad ya está hecho: solo se
// avisa en la consola.

const ultimoSuceso = new Map(); // id del locke -> { referencia, tipo, delta, cuando }

export async function apuntarSuceso(idLocke, tipo, datos = {}) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;
  const { bd, fn } = acceso;

  try {
    const referencia = await fn.addDoc(fn.collection(bd, "lockes", idLocke, "actividad"), {
      uid: usuario.uid,
      tipo,
      ...datos,
      cuando: fn.serverTimestamp()
    });
    ultimoSuceso.set(idLocke, { referencia, tipo, delta: datos.delta || 0, muerto: Boolean(datos.muerto), cuando: Date.now() });
  } catch (error) {
    console.error("No se ha podido apuntar en la actividad", error);
  }
}

// Un +1 o −1 de vidas o victorias. Si deshace lo último que hiciste hace nada (le diste sin
// querer), en vez de apuntar otro se borra aquel: así la actividad no se llena de idas y vueltas.
const PARA_DESHACER = 60 * 1000;

async function apuntarCambio(idLocke, tipo, delta) {
  const ultimo = ultimoSuceso.get(idLocke);
  const deshace =
    ultimo && ultimo.tipo === tipo && ultimo.delta === -delta && !ultimo.muerto &&
    Date.now() - ultimo.cuando < PARA_DESHACER;

  if (!deshace) {
    await apuntarSuceso(idLocke, tipo, { delta });
    return;
  }

  ultimoSuceso.delete(idLocke);
  const { fn } = baseDeDatos();
  await fn.deleteDoc(ultimo.referencia).catch((error) => console.error(error));
}

// Los últimos sucesos de un locke, en vivo, del más nuevo al más viejo. Devuelve la función
// para dejar de escuchar (se escucha solo mientras está abierta la ventana).
export function escucharActividad(idLocke, alLlegar, cuantos = 60) {
  const { bd, fn } = baseDeDatos();
  return fn.onSnapshot(
    fn.query(fn.collection(bd, "lockes", idLocke, "actividad"), fn.orderBy("cuando", "desc"), fn.limit(cuantos)),
    (instantanea) => {
      alLlegar(
        instantanea.docs.map((documento) => {
          const datos = documento.data({ serverTimestamps: "estimate" });
          return { id: documento.id, ...datos, cuando: datos.cuando ? datos.cuando.toMillis() : Date.now() };
        })
      );
    },
    (error) => {
      console.error("No se ha podido leer la actividad", error);
      alLlegar(null);
    }
  );
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

// Firestore no borra solo lo que cuelga de un documento: la actividad se borra antes, a mano
// (mientras el locke existe, que es lo que miran las reglas para dejar)
export async function borrarLocke(id) {
  const { fn, ref } = referencia(id);
  const { bd } = baseDeDatos();
  try {
    const sucesos = await fn.getDocs(fn.collection(bd, "lockes", id, "actividad"));
    await Promise.all(sucesos.docs.map((suceso) => fn.deleteDoc(suceso.ref)));
  } catch (error) {
    console.error("No se ha podido borrar la actividad del locke", error);
  }
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
  await apuntarSuceso(id, "entra");
}

// Las vidas de partida solo se pueden cambiar mientras nadie más haya aceptado: después ya
// hay gente jugando con las suyas, y sus vidas solo las toca cada uno.
export function sePuedenCambiarVidas(locke) {
  const usuario = usuarioActual();
  return (locke.jugadores || []).every(
    (uid) => uid === usuario.uid || estadoDe(locke, uid) === "pendiente"
  );
}

// Solo quien lo creó. Cambia los datos del principio (nombre, tipo, juego, descripción,
// normas y, si todavía se puede, las vidas); las suyas propias se ponen a las nuevas de
// partida. Las normas se pueden cambiar siempre, también con el locke ya terminado.
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
    normas: datos.normas || null,
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
// Echar a alguien del locke: quien lo creó, a cualquiera menos a sí mismo; los demás, solo a
// quien todavía no ha contestado. «quitado» va en la misma escritura para que las reglas
// sepan a quién se quita y lo comprueben. Al salir de «jugadores» deja de ver el locke, y con
// él su notificación.
export async function quitarDeLocke(id, uid) {
  const locke = lockePorId(id);
  if (!locke || uid === locke.creador || locke.estado === "cerrado") return;
  if (!soyCreador(locke) && estadoDe(locke, uid) !== "pendiente") return;

  const { fn, ref } = referencia(id);
  await fn.updateDoc(ref, {
    jugadores: fn.arrayRemove(uid),
    quitado: uid,
    [`estados.${uid}`]: fn.deleteField(),
    [`vidas.${uid}`]: fn.deleteField(),
    [`marcador.${uid}`]: fn.deleteField(),
    [`muertos.${uid}`]: fn.deleteField(),
    actualizado: Date.now()
  });
}

// Al borrar la cuenta: de cada locke se sale uno con todo lo suyo (nombre y foto incluidos).
// Los que creó y en los que no queda nadie más que haya aceptado, se borran enteros.
export async function salirDeTodosMisLockes() {
  const usuario = usuarioActual();
  if (!usuario) return;

  await Promise.all(
    todos.map((locke) => {
      const quedanOtros = (locke.jugadores || []).some(
        (uid) => uid !== usuario.uid && estadoDe(locke, uid) === "aceptado"
      );
      if (locke.creador === usuario.uid && !quedanOtros) return borrarLocke(locke.id);

      const { fn, ref } = referencia(locke.id);
      return fn.updateDoc(ref, {
        jugadores: fn.arrayRemove(usuario.uid),
        [`estados.${usuario.uid}`]: fn.deleteField(),
        [`vidas.${usuario.uid}`]: fn.deleteField(),
        [`marcador.${usuario.uid}`]: fn.deleteField(),
        [`nombres.${usuario.uid}`]: fn.deleteField(),
        [`fotos.${usuario.uid}`]: fn.deleteField(),
        [`muertos.${usuario.uid}`]: fn.deleteField(),
        actualizado: Date.now()
      });
    })
  );
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
