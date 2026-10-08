// Cajón de la sesión, abajo del todo del panel lateral.
// Si Firebase no está configurado no se enseña nada: la web va igual, solo que lo
// guardado se queda en este navegador.

import { iniciarNube, alCambiarSesion, entrar, salir, hayNube } from "./comun/nube.js";
import { iniciarPerfiles } from "./comun/perfiles.js";
import { iniciarLockes } from "./comun/lockes.js";
import { iniciarAvisos } from "./avisos.js";

const cajon = document.querySelector(".sesion");
const datosUsuario = cajon.querySelector(".sesion-usuario");
const foto = cajon.querySelector(".sesion-foto");
const nombre = cajon.querySelector(".sesion-nombre");
const boton = cajon.querySelector(".sesion-boton");
const aviso = cajon.querySelector(".sesion-aviso");

function pintar(usuario) {
  datosUsuario.hidden = !usuario;

  if (usuario) {
    nombre.textContent = usuario.displayName || usuario.email || "Tu cuenta";
    foto.hidden = !usuario.photoURL;
    if (usuario.photoURL) foto.src = usuario.photoURL;
    boton.textContent = "Cerrar sesión";
    aviso.textContent = "";
  } else {
    boton.textContent = "Iniciar sesión";
    aviso.textContent = "Tus equipos solo se guardan en este navegador.";
  }
}

export async function iniciarSesionUI() {
  if (!hayNube()) return; // sin configurar: el cajón se queda escondido

  cajon.hidden = false;
  alCambiarSesion(pintar);

  boton.addEventListener("click", async () => {
    boton.disabled = true;
    try {
      if (boton.textContent === "Cerrar sesión") await salir();
      else await entrar();
    } catch (error) {
      aviso.textContent = "No se ha podido completar. Inténtalo otra vez.";
      console.error(error);
    }
    boton.disabled = false;
  });

  // Todo esto antes de iniciarNube: así ya están escuchando cuando llegue la sesión
  iniciarPerfiles();
  iniciarLockes();
  iniciarAvisos();

  await iniciarNube();
}
