// Ventana del perfil: el tuyo (desde el desplegable de tu nombre) o el de un amigo (desde tu
// lista de amigos o desde «Amigos»).
//
//   · Foto: la de Google o un Pokémon (su retrato de Mundo Misterioso). En el tuyo, pulsándola
//     se cambia.
//   · Nombre, con un lápiz para cambiarlo (es el nombre de usuario, ver perfiles.js).
//   · Lockes ganados y, en el tuyo, amigos.
//   · Equipos destacados: los que cada uno elige enseñar. Se guarda una copia en el perfil
//     (escaparate), que es lo que pueden leer los demás: tus equipos de verdad son privados.
//   · En el tuyo, a la derecha, tus amigos: pulsando uno se ve su perfil.
//
// Se descarga la primera vez que se abre (ver sesion.js).

import { icono } from "./comun/iconos.js";
import { escaparHTML } from "./comun/utilidades.js";
import { usuarioActual } from "./comun/nube.js";
import {
  miPerfil, alCambiarMiPerfil, cambiarMote, guardarMiPerfil, amigosAceptados, perfilesDeAmigos,
  alCambiarPerfilesAmigos
} from "./comun/perfiles.js";
import { estaConectado, alCambiarPresencia } from "./comun/presencia.js";
import { leerGuardados } from "./equipos/estado.js";
import { pasteDelEquipo, copiarAlPortapapeles } from "./equipos/exportar.js";
import {
  imagenConRespaldo, urlsPMD, urlsPMDEmocion, urlSpriteHome, urlSpritePixel, precargarImagen
} from "./comun/imagenes.js";
import { cargarDatos, datos } from "./comun/datos.js";
import { activarAutocompletado } from "./comun/autocompletado.js";

const MAX_DESTACADOS = 6;

const dialogo = document.querySelector("#dialogo-perfil");
const cuerpo = dialogo.querySelector(".perfil-cuerpo");
const dialogoAvatar = document.querySelector("#dialogo-avatar");
const dialogoEscaparate = document.querySelector("#dialogo-escaparate");

let viendo = null;           // uid del amigo cuyo perfil se ve, o null si es el tuyo
let desdeMiPerfil = false;   // se llegó al del amigo desde tu lista (sale «Volver»)
let editandoNombre = false;
let errorNombre = "";

// ---------- Piezas ----------

function plantillaFoto(perfil, clase) {
  const nombre = perfil.nombre || "?";
  return perfil.foto
    ? `<img class="${clase}" src="${escaparHTML(perfil.foto)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="${clase} sin-foto">${escaparHTML(nombre[0].toUpperCase())}</span>`;
}

function caraDe(p) {
  const cara = p.cara && p.cara !== "Normal" ? p.cara : "";
  const titulo = p.mote ? `${p.mote} (${p.es})` : p.es;
  return imagenConRespaldo(
    [...(cara ? urlsPMDEmocion(p, cara) : []), ...urlsPMD(p), urlSpriteHome(p), p.sprite],
    `alt="${escaparHTML(p.es || "")}" title="${escaparHTML(titulo || "")}" loading="lazy"`
  );
}

function plantillaEquipo(equipo, indice, mio) {
  return `
    <article class="perfil-equipo">
      <header>
        <strong>${escaparHTML(equipo.nombre)}</strong>
        <div class="perfil-equipo-botones">
          <button class="perfil-copiar" data-indice="${indice}" title="Copiar como paste">${icono("copiar")}</button>
          ${mio ? `<button class="perfil-quitar-equipo" data-indice="${indice}" title="Dejar de destacar">${icono("aspa")}</button>` : ""}
        </div>
      </header>
      <div class="perfil-equipo-caras">${(equipo.pokemon || []).map(caraDe).join("")}</div>
    </article>`;
}

function plantillaNombre(perfil, mio) {
  if (mio && editandoNombre) {
    return `
      <form class="perfil-nombre-form">
        <input class="perfil-nombre-campo" type="text" maxlength="20" autocomplete="off" value="${escaparHTML(perfil.mote || "")}">
        <button type="submit" class="boton-verde">${icono("visto")}</button>
        <button type="button" class="boton-gris perfil-nombre-cancelar">${icono("aspa")}</button>
      </form>
      <span class="sesion-error perfil-error">${escaparHTML(errorNombre)}</span>`;
  }
  return `
    <div class="perfil-nombre-fila">
      <h2 class="perfil-nombre">${escaparHTML(perfil.nombre)}</h2>
      ${mio ? `<button class="perfil-editar-nombre" title="Cambiar nombre">${icono("lapiz")}</button>` : ""}
    </div>`;
}

function plantillaAmigos() {
  const amigos = amigosAceptados()
    .map((amistad) => perfilesDeAmigos().get(amistad.otro))
    .filter(Boolean)
    .sort((uno, otro) => Number(estaConectado(otro.uid)) - Number(estaConectado(uno.uid)) || uno.nombre.localeCompare(otro.nombre, "es"));

  return `
    <aside class="perfil-amigos">
      <h3>Amigos</h3>
      ${amigos.length
        ? amigos
            .map(
              (amigo) => `
                <button class="perfil-amigo ${estaConectado(amigo.uid) ? "conectado" : ""}" data-uid="${escaparHTML(amigo.uid)}">
                  ${plantillaFoto(amigo, "perfil-amigo-foto")}
                  <span>${escaparHTML(amigo.nombre)}</span>
                </button>`
            )
            .join("")
        : `<p class="perfil-vacio">Todavía ninguno.</p>`}
    </aside>`;
}

// ---------- Pintar ----------

function perfilQueSeVe() {
  return viendo ? perfilesDeAmigos().get(viendo) : miPerfil();
}

function pintar() {
  const perfil = perfilQueSeVe();
  const mio = !viendo;
  if (!perfil) {
    cuerpo.innerHTML = "";
    return;
  }

  const escaparate = perfil.escaparate || [];
  const ganados = (perfil.ganados || []).length;
  const amigos = amigosAceptados().length;

  cuerpo.innerHTML = `
    <div class="perfil-rejilla ${mio ? "" : "solo"}">
      <section class="perfil-principal">
        <header class="perfil-cabeza">
          ${mio
            ? `<button class="perfil-avatar" title="Cambiar foto">${plantillaFoto(perfil, "perfil-foto")}<span class="perfil-avatar-lapiz">${icono("lapiz")}</span></button>`
            : `<div class="perfil-avatar">${plantillaFoto(perfil, "perfil-foto")}</div>`}
          <div class="perfil-datos">
            ${plantillaNombre(perfil, mio)}
            <div class="perfil-cifras">
              <span><strong>${ganados}</strong> ${ganados === 1 ? "locke ganado" : "lockes ganados"}</span>
              ${mio ? `<span><strong>${amigos}</strong> ${amigos === 1 ? "amigo" : "amigos"}</span>` : ""}
            </div>
          </div>
        </header>

        <div class="perfil-apartado">
          <h3>
            Equipos destacados
            ${mio && escaparate.length < MAX_DESTACADOS ? `<button class="perfil-destacar">${icono("mas")} Destacar</button>` : ""}
          </h3>
          ${escaparate.length
            ? `<div class="perfil-equipos">${escaparate.map((equipo, indice) => plantillaEquipo(equipo, indice, mio)).join("")}</div>`
            : `<p class="perfil-vacio">Ninguno todavía.</p>`}
        </div>
      </section>
      ${mio ? plantillaAmigos() : ""}
    </div>`;

  dialogo.querySelector(".perfil-borrar").hidden = !mio;
  dialogo.querySelector(".perfil-volver").hidden = mio || !desdeMiPerfil;

  if (mio && editandoNombre) {
    const campo = cuerpo.querySelector(".perfil-nombre-campo");
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }
}

// ---------- Abrir ----------

export function abrirMiPerfil() {
  if (!usuarioActual()) return;
  viendo = null;
  desdeMiPerfil = false;
  editandoNombre = false;
  pintar();
  if (!dialogo.open) dialogo.showModal();
}

export function abrirPerfilDe(uid, desdeElMio = false) {
  viendo = uid;
  desdeMiPerfil = desdeElMio;
  editandoNombre = false;
  pintar();
  if (!dialogo.open) dialogo.showModal();
}

// ---------- Nombre ----------

async function guardarNombre() {
  const campo = cuerpo.querySelector(".perfil-nombre-campo");
  const nuevo = campo.value.trim();
  for (const boton of cuerpo.querySelectorAll(".perfil-nombre-form button")) boton.disabled = true;
  errorNombre = await cambiarMote(nuevo);
  if (!errorNombre) editandoNombre = false;
  pintar();
}

// ---------- Equipos destacados ----------

// Lo justo para pintarlo y para copiarlo como paste. JSON de ida y vuelta para quitar los
// «undefined», que Firestore no acepta.
function copiaDeEquipo(equipo) {
  return JSON.parse(
    JSON.stringify({
      id: equipo.id,
      nombre: equipo.nombre || "Equipo",
      pokemon: equipo.pokemon.map((p) => ({
        id: p.id,
        idForma: p.idForma,
        formaPMD: p.formaPMD,
        imagenForma: p.imagenForma,
        shiny: Boolean(p.shiny),
        es: p.es,
        mote: p.mote || "",
        cara: p.cara || "",
        sprite: p.sprite || ""
      })),
      paste: pasteDelEquipo(equipo.pokemon)
    })
  );
}

function pintarEscaparate() {
  const destacados = new Set(((miPerfil() || {}).escaparate || []).map((equipo) => equipo.id));
  const guardados = leerGuardados();
  dialogoEscaparate.querySelector(".escaparate-lista").innerHTML = guardados.length
    ? guardados
        .map(
          (equipo) => `
            <button class="escaparate-equipo ${destacados.has(equipo.id) ? "destacado" : ""}" data-id="${escaparHTML(equipo.id)}">
              <strong>${escaparHTML(equipo.nombre || "Equipo")}</strong>
              <span class="perfil-equipo-caras">${equipo.pokemon.map(caraDe).join("")}</span>
              ${destacados.has(equipo.id) ? icono("visto") : ""}
            </button>`
        )
        .join("")
    : `<p class="perfil-vacio">No tienes equipos guardados.</p>`;
}

// Pulsar un equipo lo destaca; si ya lo estaba, lo quita
async function alternarDestacado(id) {
  const escaparate = [...((miPerfil() || {}).escaparate || [])];
  const posicion = escaparate.findIndex((equipo) => equipo.id === id);
  if (posicion >= 0) {
    escaparate.splice(posicion, 1);
  } else {
    if (escaparate.length >= MAX_DESTACADOS) return;
    const equipo = leerGuardados().find((cada) => cada.id === id);
    if (!equipo) return;
    escaparate.push(copiaDeEquipo(equipo));
  }
  await guardarMiPerfil({ escaparate });
  if (escaparate.length >= MAX_DESTACADOS) dialogoEscaparate.close();
}

async function quitarDestacado(indice) {
  const escaparate = [...((miPerfil() || {}).escaparate || [])];
  escaparate.splice(indice, 1);
  await guardarMiPerfil({ escaparate });
}

async function copiarEquipo(boton) {
  const perfil = perfilQueSeVe();
  const equipo = ((perfil && perfil.escaparate) || [])[Number(boton.dataset.indice)];
  if (!equipo) return;
  const copiado = await copiarAlPortapapeles(equipo.paste || "");
  boton.innerHTML = icono(copiado ? "visto" : "aspa");
  setTimeout(() => (boton.innerHTML = icono("copiar")), 1500);
}

// ---------- Foto (un Pokémon) ----------

let avatarElegido = null; // { id, es }
const listaPokemon = [];

function pintarMuestra() {
  dialogoAvatar.querySelector(".avatar-muestra").innerHTML = avatarElegido
    ? imagenConRespaldo([...urlsPMD({ id: avatarElegido.id }), urlSpritePixel(avatarElegido.id)], `alt=""`)
    : plantillaFoto(miPerfil() || {}, "perfil-foto");
}

function abrirAvatar() {
  avatarElegido = null;
  dialogoAvatar.querySelector(".avatar-pokemon").value = "";
  dialogoAvatar.querySelector(".avatar-error").textContent = "";
  dialogoAvatar.querySelector(".avatar-quitar").hidden = !(miPerfil() || {}).avatar;
  pintarMuestra();
  dialogoAvatar.showModal();
  dialogoAvatar.querySelector(".avatar-pokemon").focus();
  cargarDatos()
    .then(() => listaPokemon.splice(0, listaPokemon.length, ...datos.pokemon))
    .catch((error) => console.error(error));
}

// La foto es la dirección de su retrato (si no tiene, la del sprite pequeño): así sale igual
// en todas partes donde ya se pinta la foto de alguien (Amigos, Versus...)
async function guardarAvatar() {
  if (!avatarElegido) {
    dialogoAvatar.querySelector(".avatar-error").textContent = "Elige un Pokémon de la lista.";
    return;
  }
  const opciones = [...urlsPMD({ id: avatarElegido.id }), urlSpritePixel(avatarElegido.id)];
  let foto = opciones[opciones.length - 1];
  for (const url of opciones) {
    if (await precargarImagen(url)) {
      foto = url;
      break;
    }
  }
  await guardarMiPerfil({ avatar: avatarElegido.id, foto });
  dialogoAvatar.close();
}

// Vuelve la de Google (o ninguna, en las cuentas de usuario)
async function quitarAvatar() {
  const usuario = usuarioActual();
  await guardarMiPerfil({ avatar: null, foto: (usuario && usuario.photoURL) || "" });
  dialogoAvatar.close();
}

// ---------- Arranque (al cargar el módulo) ----------

function siFalla(error) {
  console.error(error);
  errorNombre = "No se ha podido guardar. Inténtalo otra vez.";
  pintar();
}

cuerpo.addEventListener("click", (e) => {
  const boton = e.target.closest("button");
  if (!boton) return;

  if (boton.classList.contains("perfil-avatar")) abrirAvatar();
  else if (boton.classList.contains("perfil-editar-nombre")) {
    editandoNombre = true;
    errorNombre = "";
    pintar();
  } else if (boton.classList.contains("perfil-nombre-cancelar")) {
    editandoNombre = false;
    pintar();
  } else if (boton.classList.contains("perfil-destacar")) {
    pintarEscaparate();
    dialogoEscaparate.showModal();
  } else if (boton.classList.contains("perfil-quitar-equipo")) {
    quitarDestacado(Number(boton.dataset.indice)).catch(siFalla);
  } else if (boton.classList.contains("perfil-copiar")) {
    copiarEquipo(boton).catch((error) => console.error(error));
  } else if (boton.classList.contains("perfil-amigo")) {
    abrirPerfilDe(boton.dataset.uid, true);
  }
});

cuerpo.addEventListener("submit", (e) => {
  e.preventDefault();
  guardarNombre().catch(siFalla);
});

dialogo.querySelector(".perfil-cerrar").addEventListener("click", () => dialogo.close());
dialogo.querySelector(".perfil-volver").addEventListener("click", abrirMiPerfil);
dialogo.addEventListener("close", () => (editandoNombre = false));

dialogoEscaparate.querySelector(".escaparate-cerrar").addEventListener("click", () => dialogoEscaparate.close());
dialogoEscaparate.querySelector(".escaparate-lista").addEventListener("click", (e) => {
  const equipo = e.target.closest(".escaparate-equipo");
  if (equipo) alternarDestacado(equipo.dataset.id).catch(siFalla);
});

const campoAvatar = dialogoAvatar.querySelector(".avatar-pokemon");
campoAvatar.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && campoAvatar.parentElement.querySelector(".sugerencias .opcion")) e.preventDefault();
});
const autocompletadoAvatar = activarAutocompletado(campoAvatar, listaPokemon, (pokemon) => {
  avatarElegido = pokemon;
  campoAvatar.value = pokemon.es;
  pintarMuestra();
});
campoAvatar.addEventListener("input", () => (avatarElegido = null));
dialogoAvatar.querySelector(".avatar-formulario").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!avatarElegido && campoAvatar.value.trim()) autocompletadoAvatar.elegirPrimera();
  guardarAvatar().catch((error) => {
    console.error(error);
    dialogoAvatar.querySelector(".avatar-error").textContent = "No se ha podido guardar.";
  });
});
dialogoAvatar.querySelector(".avatar-cancelar").addEventListener("click", () => dialogoAvatar.close());
dialogoAvatar.querySelector(".avatar-quitar").addEventListener("click", () => {
  quitarAvatar().catch((error) => console.error(error));
});

// Al día mientras está abierto: tu perfil, el del amigo, quién está conectado
const repintar = () => {
  if (dialogo.open && !editandoNombre) pintar();
  if (dialogoEscaparate.open) pintarEscaparate();
};
alCambiarMiPerfil(repintar);
alCambiarPerfilesAmigos(repintar);
alCambiarPresencia(repintar);
