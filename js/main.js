import { activarRespaldoImagenes } from "./comun/imagenes.js";
import { iniciarNavegacion, irA } from "./navegacion.js";
import { iniciarSesionUI } from "./sesion.js";

activarRespaldoImagenes();
iniciarNavegacion();
irA("crear");

// La sesión se monta aparte: si falla, la web sigue funcionando con el navegador
iniciarSesionUI().catch((error) => console.error(error));
