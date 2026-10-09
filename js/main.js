import { activarRespaldoImagenes } from "./comun/imagenes.js";
import { iniciarNavegacion, irA, vistaInicial } from "./navegacion.js";
import { iniciarSesionUI } from "./sesion.js";

activarRespaldoImagenes();
iniciarNavegacion();
irA(vistaInicial()); // la que hubiera al recargar, o Versus si se entra de nuevas

// La sesión se monta aparte: si falla, la web sigue funcionando con el navegador
iniciarSesionUI().catch((error) => console.error(error));

// Guarda en el ordenador las imágenes y datos de fuera (ver sw.js). Si el navegador no
// lo admite o falla, la web va igual, solo que sin ese ahorro.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((error) => console.error(error));
}
