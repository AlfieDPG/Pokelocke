// ---------- Contadores ----------
//
// Cuántas veces se ha hecho algo que no deja rastro en ningún otro sitio (tirar de la ruleta,
// exportar un equipo, mirar una línea evolutiva...). Solo sirven para los logros
// (js/comun/logros.js). Se guardan como los equipos (en el navegador y, con sesión, en tu
// cuenta).
//
//   localStorage «poketeams-contadores-v1»: { ruleta: 3, exportar: 1, ... }

import { leer, escribir } from "./almacen.js";

const CLAVE = "poketeams-contadores-v1";

export function contadores() {
  return leer(CLAVE, {}) || {};
}

export function sumarContador(nombre) {
  const todos = contadores();
  todos[nombre] = (todos[nombre] || 0) + 1;
  escribir(CLAVE, todos);
}
