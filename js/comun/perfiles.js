// ---------- Perfiles, amistades y palmarés ----------
//
// Esto NO pasa por localStorage. Los equipos, las rutas y los level caps son tuyos y la
// nube solo guarda una copia (ver almacen.js y nube.js). Un amigo o un locke compartido,
// en cambio, es un dato de dos personas: si cada navegador se guardase su copia volvería
// el problema de quién pisa a quién. Así que se lee y se escribe directamente en Firestore.
//
// Colecciones (las reglas están en firestore.rules):
//
//   perfiles/{uid}   { nombre, foto, correo, tipos, ganados, legado }
//   amistades/{par}  { miembros: [uidA, uidB], estado, pidio, creado }
//
//   · tipos:   los tipos de locke que usa esa persona, editables.
//              [{ id, nombre, color }]
//   · ganados: su palmarés entero. Cada entrada se queda con una COPIA del tipo, no con
//              una referencia, para que renombrar un tipo no reescriba la historia.
//              [{ id, nombre, tipo: { id, nombre, color }, nota }]
//   · legado:  qué ficha de las de antes (js/comun/legado.js) es esta persona, o "".

import { usuarioActual, baseDeDatos, alCambiarSesion } from "./nube.js";

// Con lo que empieza una cuenta nueva: solo el locke normal. Cada uno puede renombrarlo,
// cambiarle el color o añadir los suyos (Megalocke, Bebelocke... son inventos de cada grupo).
//
// Ojo: esto solo vale para perfiles NUEVOS. Los que ya existían guardaron su lista al
// crearse y la conservan.
export const TIPOS_POR_DEFECTO = [
  { id: "locke", nombre: "Locke", color: "#3498db" }
];

const PERFIL_VACIO = { nombre: "Jugador", foto: "", correo: "", tipos: [], ganados: [], legado: "" };

let mio = null;              // mi perfil, siempre al día (hay un onSnapshot encima)
let dejarDeEscuchar = null;
let falloPerfil = "";        // por qué no ha cargado, para poder decirlo en pantalla
const oyentes = new Set();

// Mis amistades, también en vivo: así en cuanto alguien te acepta te sale sin recargar
let listaAmistades = [];
let dejarDeEscucharAmistades = null;
let errorAmistades = "";
const oyentesAmistades = new Set();

// ---------- Avisos ----------

export function miPerfil() {
  return mio;
}

export function fallaElPerfil() {
  return falloPerfil;
}

// Mientras el perfil no llega (o si Firestore no deja leerlo) se tira de lo que da Google,
// para que la web pueda seguir enseñando cosas en vez de quedarse muda.
export function miPerfilOProvisional() {
  if (mio) return mio;

  const usuario = usuarioActual();
  if (!usuario) return null;

  return {
    uid: usuario.uid,
    ...PERFIL_VACIO,
    nombre: usuario.displayName || (usuario.email || "").split("@")[0] || "Jugador",
    foto: usuario.photoURL || "",
    correo: (usuario.email || "").toLowerCase(),
    tipos: TIPOS_POR_DEFECTO
  };
}

function explicar(error, queCosa) {
  return error && error.code === "permission-denied"
    ? `Firebase no deja leer ${queCosa}. Falta publicar las reglas de Firestore.`
    : `No se ha podido cargar ${queCosa}.`;
}

// Avisa cada vez que cambia mi perfil, incluido el primer momento. Devuelve una función
// para darse de baja.
export function alCambiarMiPerfil(funcion) {
  oyentes.add(funcion);
  funcion(mio);
  return () => oyentes.delete(funcion);
}

function avisar() {
  for (const funcion of oyentes) funcion(mio);
}

// ---------- Avisos de las amistades ----------

export function amistades() {
  return listaAmistades;
}

export function amigosAceptados() {
  return listaAmistades.filter((amistad) => amistad.estado === "ok");
}

// Las que te han mandado a ti y aún no has contestado
export function solicitudesRecibidas() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  return listaAmistades.filter(
    (amistad) => amistad.estado === "pendiente" && amistad.pidio !== usuario.uid
  );
}

export function solicitudesEnviadas() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  return listaAmistades.filter(
    (amistad) => amistad.estado === "pendiente" && amistad.pidio === usuario.uid
  );
}

export function fallaLasAmistades() {
  return errorAmistades;
}

export function alCambiarAmistades(funcion) {
  oyentesAmistades.add(funcion);
  funcion(listaAmistades);
  return () => oyentesAmistades.delete(funcion);
}

function avisarAmistades() {
  for (const funcion of oyentesAmistades) funcion(listaAmistades);
}

// ---------- Utilidades ----------

// El id del documento de amistad: los dos uid ordenados. Da igual quién lo cree.
export function idAmistad(unUid, otroUid) {
  return [unUid, otroUid].sort().join("_");
}

// Los tipos de un perfil, con los de siempre como red de seguridad
export function tiposDe(perfil) {
  const tipos = perfil && perfil.tipos;
  return tipos && tipos.length ? tipos : TIPOS_POR_DEFECTO;
}

// Los tipos que hay que enseñar en una ficha: los suyos, más los que aparezcan en el
// palmarés y ya no estén en su lista (lockes ganados con un tipo que luego borró).
export function tiposParaFicha(perfil) {
  const tipos = tiposDe(perfil).slice();
  const vistos = new Set(tipos.map((tipo) => tipo.id));

  for (const ganado of (perfil && perfil.ganados) || []) {
    const tipo = ganado.tipo;
    if (!tipo || vistos.has(tipo.id)) continue;
    vistos.add(tipo.id);
    tipos.push(tipo);
  }

  return tipos;
}

// Id para las entradas que se apuntan a mano (las automáticas usan el id del locke)
export function nuevoId() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- Arranque ----------

export function iniciarPerfiles() {
  alCambiarSesion(async (usuario) => {
    if (dejarDeEscuchar) {
      dejarDeEscuchar();
      dejarDeEscuchar = null;
    }
    if (dejarDeEscucharAmistades) {
      dejarDeEscucharAmistades();
      dejarDeEscucharAmistades = null;
    }

    listaAmistades = [];
    errorAmistades = "";
    falloPerfil = "";

    if (!usuario) {
      mio = null;
      avisar();
      avisarAmistades();
      return;
    }

    escucharAmistades(usuario);
    // Se escucha ya, sin esperar a asegurarPerfil: así el perfil sale de la caché al
    // momento en vez de después de dos viajes al servidor
    escucharMiPerfil(usuario);

    try {
      await asegurarPerfil(usuario);
    } catch (error) {
      console.error("No se ha podido preparar el perfil", error);
      falloPerfil = explicar(error, "tu perfil");
      avisar();
      return;
    }

    try {
      await apuntarLockesGanados();
    } catch (error) {
      console.error("No se han podido apuntar los lockes ganados", error);
    }
  });
}

// Crea el perfil la primera vez. Después solo refresca nombre, foto y correo, que los
// manda Google y pueden haber cambiado.
async function asegurarPerfil(usuario) {
  const { bd, fn } = baseDeDatos();
  const referencia = fn.doc(bd, "perfiles", usuario.uid);
  const guardado = await fn.getDoc(referencia);

  const deGoogle = {
    nombre: usuario.displayName || (usuario.email || "").split("@")[0] || "Jugador",
    foto: usuario.photoURL || "",
    correo: (usuario.email || "").toLowerCase()
  };

  if (guardado.exists()) {
    await fn.updateDoc(referencia, deGoogle);
    return;
  }

  await fn.setDoc(referencia, {
    ...PERFIL_VACIO,
    ...deGoogle,
    tipos: TIPOS_POR_DEFECTO
  });
}

function escucharMiPerfil(usuario) {
  const { bd, fn } = baseDeDatos();

  dejarDeEscuchar = fn.onSnapshot(
    fn.doc(bd, "perfiles", usuario.uid),
    (documento) => {
      // La primera vez que entras el perfil aún no existe: llega en cuanto asegurarPerfil
      // lo crea. Mientras, se queda en null (y se tira del provisional, con sus tipos).
      if (!documento.exists()) return;
      falloPerfil = "";
      mio = { uid: usuario.uid, ...PERFIL_VACIO, ...documento.data() };
      avisar();
    },
    (error) => {
      console.error("Se ha perdido la conexión con el perfil", error);
      falloPerfil = explicar(error, "tu perfil");
      avisar();
    }
  );
}

function escucharAmistades(usuario) {
  const { bd, fn } = baseDeDatos();

  dejarDeEscucharAmistades = fn.onSnapshot(
    fn.query(fn.collection(bd, "amistades"), fn.where("miembros", "array-contains", usuario.uid)),
    (instantanea) => {
      errorAmistades = "";
      listaAmistades = instantanea.docs.map((documento) => {
        const datos = documento.data();
        return {
          id: documento.id,
          ...datos,
          otro: datos.miembros.find((uid) => uid !== usuario.uid) || usuario.uid
        };
      });
      avisarAmistades();
    },
    (error) => {
      console.error("No se han podido leer las amistades", error);
      // Lo normal es que falten las reglas por publicar, así que se dice tal cual
      errorAmistades = explicar(error, "las amistades");
      avisarAmistades();
    }
  );
}

// ---------- Escribir mi perfil ----------

export async function guardarMiPerfil(cambios) {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;

  const { bd, fn } = acceso;
  await fn.updateDoc(fn.doc(bd, "perfiles", usuario.uid), cambios);
}

// ---------- Leer otros perfiles ----------

export async function perfilesDe(uids) {
  const acceso = baseDeDatos();
  const mapa = new Map();
  if (!acceso || !uids.length) return mapa;

  const { bd, fn } = acceso;
  const perfiles = await Promise.all(
    uids.map(async (uid) => {
      const documento = await fn.getDoc(fn.doc(bd, "perfiles", uid));
      return { uid, ...PERFIL_VACIO, ...(documento.data() || {}) };
    })
  );

  for (const perfil of perfiles) mapa.set(perfil.uid, perfil);
  return mapa;
}

export async function buscarPorCorreo(correo) {
  const acceso = baseDeDatos();
  if (!acceso) return null;

  const { bd, fn } = acceso;
  const encontrados = await fn.getDocs(
    fn.query(fn.collection(bd, "perfiles"), fn.where("correo", "==", correo.trim().toLowerCase()))
  );

  if (encontrados.empty) return null;
  const documento = encontrados.docs[0];
  return { uid: documento.id, ...PERFIL_VACIO, ...documento.data() };
}

// ---------- Amistades ----------

export async function pedirAmistad(otroUid) {
  const usuario = usuarioActual();
  const { bd, fn } = baseDeDatos();
  const id = idAmistad(usuario.uid, otroUid);

  await fn.setDoc(fn.doc(bd, "amistades", id), {
    miembros: [usuario.uid, otroUid].sort(),
    estado: "pendiente",
    pidio: usuario.uid,
    creado: Date.now()
  });

  return id;
}

export async function aceptarAmistad(id) {
  const { bd, fn } = baseDeDatos();
  await fn.updateDoc(fn.doc(bd, "amistades", id), { estado: "ok" });
}

export async function borrarAmistad(id) {
  const { bd, fn } = baseDeDatos();
  await fn.deleteDoc(fn.doc(bd, "amistades", id));
}

// Lo que se guarda en tus lockes ganados de un locke de Versus. Es una copia, no un enlace:
// tus amigos ven tu ficha pero no pueden leer los lockes en los que no han jugado, así que
// todo lo que salga en la ficha (quién jugó, con cuántas vidas acabó, cuándo terminó) tiene
// que ir aquí dentro.
function resumenDeLocke(id, locke) {
  const nombres = locke.nombres || {};
  const vidas = locke.vidas || {};
  const estados = locke.estados || {};

  const participantes = (locke.jugadores || [])
    .filter((uid) => (estados[uid] || "aceptado") === "aceptado")
    .map((uid) => ({
      nombre: nombres[uid] || "Jugador",
      vidas: locke.vidasIlimitadas ? null : vidas[uid] || 0
    }));

  return {
    id,
    nombre: locke.nombre,
    nota: "",
    tipo: locke.tipo,
    juego: locke.juego || "",
    juegoOtro: locke.juegoOtro || "",
    fechaFin: locke.fechaFin || "",
    ganador: nombres[locke.ganador] || "",
    participantes
  };
}

// ---------- Lockes ganados automáticos ----------
//
// Al cerrar un locke, el que lo cierra marca el ganador. El +1 en el palmarés no lo puede
// escribir él: las reglas solo dejan que cada uno escriba su propio perfil. Así que lo
// hace el ganador en cuanto abre la web, y el locke se queda apuntado en «contado» para
// que no se sume dos veces.
//
// Sin Cloud Functions a propósito: esas piden plan de pago.

export async function apuntarLockesGanados() {
  const usuario = usuarioActual();
  const acceso = baseDeDatos();
  if (!usuario || !acceso) return;

  const { bd, fn } = acceso;

  // Solo se filtra por «array-contains» y el resto se mira aquí: con tres condiciones
  // Firestore pediría crear un índice a mano y no hace falta para tan pocos lockes.
  const encontrados = await fn.getDocs(
    fn.query(fn.collection(bd, "lockes"), fn.where("jugadores", "array-contains", usuario.uid))
  );

  const nuevos = [];
  const porMarcar = [];

  encontrados.forEach((documento) => {
    const locke = documento.data();
    if (locke.estado !== "cerrado" || locke.ganador !== usuario.uid) return;
    if ((locke.contado || []).includes(usuario.uid)) return;

    nuevos.push(resumenDeLocke(documento.id, locke));
    porMarcar.push(documento.ref);
  });

  if (!nuevos.length) return;

  const referencia = fn.doc(bd, "perfiles", usuario.uid);
  const guardado = await fn.getDoc(referencia);
  const ganados = (guardado.data() || {}).ganados || [];
  const yaEstan = new Set(ganados.map((ganado) => ganado.id));

  await fn.updateDoc(referencia, {
    ganados: [...ganados, ...nuevos.filter((nuevo) => !yaEstan.has(nuevo.id))]
  });

  await Promise.all(
    porMarcar.map((referenciaLocke) =>
      fn.updateDoc(referenciaLocke, { contado: fn.arrayUnion(usuario.uid) })
    )
  );
}
