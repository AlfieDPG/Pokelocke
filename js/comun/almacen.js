// Datos guardados en el navegador (localStorage) en formato JSON.
// Si el navegador no deja leer o guardar, la web sigue funcionando.

export function leer(clave, porDefecto) {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : porDefecto;
  } catch (error) {
    return porDefecto;
  }
}

// Devuelve false si el navegador no deja guardar
export function escribir(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    return false;
  }
}
