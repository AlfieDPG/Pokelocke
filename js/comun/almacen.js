// Datos guardados en el navegador (localStorage) en formato JSON.
// Si el navegador no deja leer o guardar, la web sigue funcionando.
//
// El navegador sigue siendo el sitio donde se guarda todo: la nube (js/comun/nube.js)
// solo es una copia para poder entrar desde otro sitio. Así la web funciona igual sin
// conexión y sin haber iniciado sesión, y leer() y escribir() siguen siendo inmediatos.

// Claves que se copian a la nube: son las cosas que ha hecho el usuario.
// NO entran las cachés de datos descargados (poketeams-datos-*, poketeams-pokedex-*),
// que cada navegador se rehace solo y solo servirían para gastar cuota.
export const CLAVES_SINCRONIZADAS = [
  "poketeams-equipo-v1",                  // equipo que se está editando
  "poketeams-equipos-v1",                 // «Mis equipos»
  "poketeams-actual-v1",                  // nombre e id del equipo en edición
  "poketeams-equipos-orden-v1",           // si ya se ordenaron los equipos una vez
  "poketeams-equipos-vista-v1",           // tarjetas o lista
  "poketeams-rutas-v2",                   // rutas marcadas
  "poketeams-rutas-juego-v1",             // juego elegido en «Rutas»
  "poketeams-levelcaps-v2",               // combates superados
  "poketeams-levelcaps-juego-v1",         // juego elegido en «Level caps»
  "poketeams-levelcaps-multiplicador-v1", // multiplicador de nivel
  "poketeams-normas-v2"                   // conjuntos de normas propios
];

// Cuándo se cambió cada clave por última vez: { clave: milisegundos }.
// Sirve para decidir, al entrar, si manda lo del navegador o lo de la nube.
const CLAVE_TIEMPOS = "poketeams-tiempos-v1";

function bruto(clave, porDefecto) {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : porDefecto;
  } catch (error) {
    return porDefecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    return false;
  }
}

export function leer(clave, porDefecto) {
  return bruto(clave, porDefecto);
}

export function tiempos() {
  return bruto(CLAVE_TIEMPOS, {});
}

function apuntarTiempo(clave, cuando) {
  const todos = tiempos();
  todos[clave] = cuando;
  guardar(CLAVE_TIEMPOS, todos);
}

// A quién avisar cuando cambie algo que se sincroniza (lo usa nube.js)
let avisar = null;

export function alCambiar(funcion) {
  avisar = funcion;
}

// Devuelve false si el navegador no deja guardar
export function escribir(clave, valor) {
  const ok = guardar(clave, valor);
  if (!ok || !CLAVES_SINCRONIZADAS.includes(clave)) return ok;

  apuntarTiempo(clave, Date.now());
  if (avisar) avisar(clave);
  return ok;
}

// Borra de este navegador todo lo que se sincroniza, con sus fechas. Se usa cuando entra
// una cuenta distinta de la última que usó este navegador, para no mezclar datos de dos
// personas (si no, los equipos del anterior acabarían subidos a la cuenta del nuevo).
export function vaciarSincronizadas() {
  for (const clave of CLAVES_SINCRONIZADAS) {
    try {
      localStorage.removeItem(clave);
    } catch (error) {
      // si el navegador no deja, se queda como esté
    }
  }
  guardar(CLAVE_TIEMPOS, {});
}

// Guarda algo que viene de la nube: se respeta su fecha y no se vuelve a subir.
// Devuelve true si el valor era distinto del que había.
export function escribirDesdeLaNube(clave, valor, cuando) {
  const cambia = JSON.stringify(bruto(clave, null)) !== JSON.stringify(valor);
  guardar(clave, valor);
  apuntarTiempo(clave, cuando);
  return cambia;
}
