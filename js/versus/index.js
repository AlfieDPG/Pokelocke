// Sección «Versus»: el marcador compartido de un locke.
//
// Creas un locke, le pones nombre, tipo y vidas, y eliges a qué amigos invitas. Hasta que
// no aceptan (desde el buzón del panel lateral) salen marcados como pendientes. A partir de
// ahí los dos veis el mismo marcador: si uno pierde una vida la quita y al otro le cambia
// en pantalla al momento.
//
// Aquí solo está la pantalla. Los datos y las escrituras están en js/comun/lockes.js.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { hayNube, usuarioActual } from "../comun/nube.js";
import {
  tiposDe, miPerfilOProvisional, fallaElPerfil, amigosAceptados, perfilesDe, fallaLasAmistades
} from "../comun/perfiles.js";
import {
  alCambiarLockes, misLockes, invitacionesALockes, estadoDe, fallaLosLockes,
  crearLocke, invitarALocke, cambiarNumero, elegirGanador, borrarLocke, lockePorId
} from "../comun/lockes.js";

let seccion = null;
let lista = null;
let aviso = null;
let dialogo = null;
let botonNuevo = null;

let invitados = []; // perfiles que salen en el diálogo, para copiar su nombre y foto

let dialogoInvitar = null;
let porInvitar = []; // lo mismo, para el diálogo de invitar a un locke ya creado

function colorSeguro(color) {
  return /^#[0-9a-f]{6}$/i.test(String(color || "")) ? color : "#3498db";
}

// ---------- Pintar ----------

// Con vidas ilimitadas no hay nada que contar: se enseña el infinito y se quitan los botones
function plantillaVidas(locke, uid, soloLectura) {
  if (locke.vidasIlimitadas) {
    return `
      <div class="locke-numero vidas ilimitadas" title="Vidas ilimitadas">
        <span class="locke-valor">${icono("corazon")}∞</span>
      </div>`;
  }

  const vidas = (locke.vidas || {})[uid] || 0;

  return `
    <div class="locke-numero vidas">
      <button class="menos" data-campo="vidas" aria-label="Quitar vida" ${soloLectura ? "disabled" : ""}>${icono("menos")}</button>
      <span class="locke-valor">${icono("corazon")}${vidas}</span>
      <button class="mas" data-campo="vidas" aria-label="Sumar vida" ${soloLectura ? "disabled" : ""}>${icono("mas")}</button>
    </div>`;
}

function plantillaJugador(locke, uid, soloLectura) {
  const nombre = escaparHTML((locke.nombres || {})[uid] || "Jugador");
  const foto = (locke.fotos || {})[uid] || "";
  const puntos = (locke.marcador || {})[uid] || 0;
  const gano = locke.ganador === uid;
  const pendiente = estadoDe(locke, uid) === "pendiente";

  return `
    <div class="locke-jugador ${gano ? "ganador" : ""} ${pendiente ? "pendiente" : ""}" data-uid="${escaparHTML(uid)}">
      <div class="locke-cara">
        ${foto ? `<img src="${escaparHTML(foto)}" alt="" referrerpolicy="no-referrer" data-respaldo="" data-quitar-si-falla>` : ""}
      </div>
      <span class="locke-quien">${nombre}</span>
      ${gano ? `<span class="locke-corona">${icono("corona")}</span>` : ""}
      ${pendiente ? `<span class="locke-pendiente">Sin contestar</span>` : ""}

      <div class="locke-numero marcador">
        <button class="menos" data-campo="marcador" aria-label="Quitar victoria" ${soloLectura ? "disabled" : ""}>${icono("menos")}</button>
        <span class="locke-valor">${puntos}</span>
        <button class="mas" data-campo="marcador" aria-label="Sumar victoria" ${soloLectura ? "disabled" : ""}>${icono("mas")}</button>
      </div>

      ${plantillaVidas(locke, uid, soloLectura)}

      ${soloLectura ? "" : `<button class="locke-ganador">${icono("corona")} Ganó</button>`}
    </div>`;
}

function plantillaLocke(locke) {
  const usuario = usuarioActual();
  const cerrado = locke.estado === "cerrado";
  const tipo = locke.tipo || { nombre: "Locke", color: "#3498db" };
  const soyElCreador = locke.creador === usuario.uid;

  const ganador = cerrado ? escaparHTML((locke.nombres || {})[locke.ganador] || "alguien") : "";

  return `
    <article class="locke ${cerrado ? "cerrado" : "abierto"}" data-id="${escaparHTML(locke.id)}"
             style="--color-locke: ${colorSeguro(tipo.color)}">
      <header class="locke-cabecera">
        <span class="locke-tipo">${escaparHTML(tipo.nombre)}</span>
        <h2 class="locke-titulo">${escaparHTML(locke.nombre)}</h2>
        ${cerrado ? `<span class="locke-resultado">${icono("corona")} Ganó ${ganador}</span>` : ""}
        <div class="locke-acciones">
          ${cerrado ? "" : `<button class="locke-invitar" title="Invitar amigos">${icono("personaMas")}</button>`}
          ${soyElCreador ? `<button class="locke-borrar" title="Borrar locke">${icono("papelera")}</button>` : ""}
        </div>
      </header>

      ${locke.descripcion ? `<p class="locke-descripcion">${escaparHTML(locke.descripcion)}</p>` : ""}

      <div class="locke-jugadores">
        ${locke.jugadores.map((uid) => plantillaJugador(locke, uid, cerrado)).join("")}
      </div>
    </article>`;
}

function pintar() {
  if (!hayNube() || !usuarioActual()) {
    lista.innerHTML = "";
    botonNuevo.hidden = true;
    aviso.textContent = "";
    return;
  }

  botonNuevo.hidden = false;

  const fallo = fallaLosLockes();
  const pendientes = invitacionesALockes().length;
  const mios = misLockes();

  if (fallo) aviso.textContent = fallo;
  else if (pendientes) {
    aviso.textContent = `Tienes ${pendientes} invitación${pendientes === 1 ? "" : "es"} sin contestar en el buzón del panel lateral.`;
  } else if (!mios.length) {
    aviso.textContent = "Todavía no tienes ningún locke. Crea uno con «Nuevo locke».";
  } else {
    aviso.textContent = "";
  }

  // Primero los que están en marcha, y dentro de cada grupo el más nuevo arriba
  const ordenados = [...mios].sort((uno, otro) => {
    if ((uno.estado === "cerrado") !== (otro.estado === "cerrado")) {
      return uno.estado === "cerrado" ? 1 : -1;
    }
    return (otro.creado || 0) - (uno.creado || 0);
  });

  lista.innerHTML = ordenados.map(plantillaLocke).join("");
}

// ---------- Diálogo de nuevo locke ----------

// Si una de las casillas del diálogo no está (un index.html viejo en la caché del navegador
// junto a un JavaScript nuevo), se avisa en vez de reventar en silencio.
function campo(selector) {
  const elemento = dialogo.querySelector(selector);
  if (!elemento) throw new Error(`Falta ${selector} en index.html. Recarga con Ctrl+F5.`);
  return elemento;
}

async function abrirDialogo() {
  // Lo primero, abrir. Pase lo que pase después, el botón nunca puede quedarse sin
  // hacer nada: si algo falla, se ve el motivo dentro del diálogo.
  if (!dialogo.open) dialogo.showModal();

  const error = campo(".locke-error");
  error.textContent = "";

  // Si el perfil no ha cargado se tira del nombre y la foto de Google y de los tipos de
  // siempre: así al menos se puede rellenar el formulario y ver qué pasa al crear.
  const mio = miPerfilOProvisional();
  error.textContent = fallaElPerfil() || fallaLasAmistades();

  campo("#locke-nombre").value = "";
  campo("#locke-descripcion").value = "";
  campo("#locke-vidas").value = "3";
  campo("#locke-vidas").disabled = false;
  campo("#locke-infinitas").checked = false;

  campo("#locke-tipo").innerHTML = tiposDe(mio)
    .map((tipo) => `<option value="${escaparHTML(tipo.id)}">${escaparHTML(tipo.nombre)}</option>`)
    .join("");

  campo(".locke-amigos").innerHTML = `<p class="locke-sin-amigos">Cargando...</p>`;
  campo("#locke-nombre").focus();

  const aceptados = amigosAceptados();

  if (!aceptados.length) {
    invitados = [];
    dialogo.querySelector(".locke-amigos").innerHTML =
      `<p class="locke-sin-amigos">Todavía no tienes amigos. Puedes crear el locke solo para ti y meter gente más adelante.</p>`;
    return;
  }

  const perfiles = await perfilesDe(aceptados.map((amistad) => amistad.otro));
  invitados = [...perfiles.values()];

  dialogo.querySelector(".locke-amigos").innerHTML = invitados
    .map(
      (perfil) => `
        <label class="locke-amigo">
          <input type="checkbox" value="${escaparHTML(perfil.uid)}">
          <span>${escaparHTML(perfil.nombre)}</span>
        </label>`
    )
    .join("");
}

async function crear() {
  const mio = miPerfilOProvisional();
  const usuario = usuarioActual();
  const error = dialogo.querySelector(".locke-error");

  const nombre = dialogo.querySelector("#locke-nombre").value.trim();
  const descripcion = dialogo.querySelector("#locke-descripcion").value.trim();
  const vidasIlimitadas = dialogo.querySelector("#locke-infinitas").checked;
  const vidas = Math.max(0, Math.min(999, Number(dialogo.querySelector("#locke-vidas").value) || 0));
  const idTipo = dialogo.querySelector("#locke-tipo").value;
  const tipo = tiposDe(mio).find((cada) => cada.id === idTipo) || tiposDe(mio)[0];

  // Lo único imprescindible es el nombre: un locke para ti solo también vale
  if (!nombre) {
    error.textContent = "Ponle un nombre.";
    dialogo.querySelector("#locke-nombre").focus();
    return;
  }

  const elegidos = [...dialogo.querySelectorAll(".locke-amigos input:checked")].map((casilla) => casilla.value);

  const nombres = { [usuario.uid]: mio.nombre };
  const fotos = { [usuario.uid]: mio.foto || "" };

  for (const perfil of invitados) {
    if (!elegidos.includes(perfil.uid)) continue;
    nombres[perfil.uid] = perfil.nombre;
    fotos[perfil.uid] = perfil.foto || "";
  }

  await crearLocke({
    nombre, descripcion, tipo, vidas, vidasIlimitadas, invitados: elegidos, nombres, fotos
  });
  dialogo.close();
}

// ---------- Invitar a un locke que ya existe ----------
//
// Cualquiera que esté dentro puede invitar, no solo quien lo creó: si Pedro quiere meter a
// Marc en un locke tuyo, tiene sentido que pueda. Salen sus amigos que aún no están dentro.

async function abrirInvitar(id) {
  const locke = lockePorId(id);
  if (!locke) return;

  const caja = dialogoInvitar.querySelector(".invitar-amigos");
  const enviar = dialogoInvitar.querySelector("#invitar-enviar");

  dialogoInvitar.dataset.id = id;
  dialogoInvitar.querySelector(".invitar-titulo").textContent = `«${locke.nombre}»`;
  dialogoInvitar.querySelector(".invitar-error").textContent = fallaLasAmistades();
  caja.innerHTML = `<p class="locke-sin-amigos">Cargando...</p>`;
  enviar.disabled = true;
  if (!dialogoInvitar.open) dialogoInvitar.showModal();

  const dentro = new Set(locke.jugadores);
  const aceptados = amigosAceptados();
  const fuera = aceptados.filter((amistad) => !dentro.has(amistad.otro));

  if (!fuera.length) {
    porInvitar = [];
    caja.innerHTML = aceptados.length
      ? `<p class="locke-sin-amigos">Todos tus amigos están ya en este locke.</p>`
      : `<p class="locke-sin-amigos">Todavía no tienes amigos. Agrégalos en «Amigos» y espera a que te acepten.</p>`;
    return;
  }

  const perfiles = await perfilesDe(fuera.map((amistad) => amistad.otro));
  porInvitar = [...perfiles.values()];

  caja.innerHTML = porInvitar
    .map(
      (perfil) => `
        <label class="locke-amigo">
          <input type="checkbox" value="${escaparHTML(perfil.uid)}">
          <span>${escaparHTML(perfil.nombre)}</span>
        </label>`
    )
    .join("");
  enviar.disabled = false;
}

async function enviarInvitaciones() {
  const error = dialogoInvitar.querySelector(".invitar-error");
  const elegidos = [...dialogoInvitar.querySelectorAll(".invitar-amigos input:checked")].map((c) => c.value);

  if (!elegidos.length) {
    error.textContent = "Elige a quién invitas.";
    return;
  }

  await invitarALocke(
    dialogoInvitar.dataset.id,
    porInvitar.filter((perfil) => elegidos.includes(perfil.uid))
  );
  dialogoInvitar.close();
}

// ---------- Arranque ----------

export function iniciar() {
  seccion = document.querySelector("#vista-versus");
  lista = seccion.querySelector(".versus-lista");
  aviso = seccion.querySelector(".versus-aviso");
  botonNuevo = seccion.querySelector("#nuevo-locke");
  dialogo = document.querySelector("#dialogo-nuevo-locke");
  dialogoInvitar = document.querySelector("#dialogo-invitar");

  dialogoInvitar.querySelector("#invitar-cancelar").addEventListener("click", () => dialogoInvitar.close());
  dialogoInvitar.querySelector("#invitar-enviar").addEventListener("click", () => {
    dialogoInvitar.querySelector(".invitar-error").textContent = "";
    enviarInvitaciones().catch((error) => {
      console.error(error);
      dialogoInvitar.querySelector(".invitar-error").textContent =
        error.code === "permission-denied"
          ? "Firebase no deja invitar. Falta publicar las reglas de Firestore."
          : "No se ha podido invitar. Inténtalo otra vez.";
    });
  });

  botonNuevo.addEventListener("click", () => {
    abrirDialogo().catch((error) => {
      console.error(error);
      // Se dice en los dos sitios: dentro del diálogo si llegó a abrirse, y debajo del
      // botón por si no.
      const texto = error && error.message ? error.message : "No se ha podido abrir.";
      const hueco = dialogo.querySelector(".locke-error");
      if (hueco) hueco.textContent = texto;
      aviso.textContent = texto;
    });
  });

  dialogo.querySelector("#locke-cancelar").addEventListener("click", () => dialogo.close());

  // Con vidas ilimitadas el número no pinta nada
  dialogo.querySelector("#locke-infinitas").addEventListener("change", (e) => {
    dialogo.querySelector("#locke-vidas").disabled = e.target.checked;
  });

  // Enter en el nombre crea, como en el resto de la web
  dialogo.querySelector("#locke-nombre").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      dialogo.querySelector("#locke-crear").click();
    }
  });
  dialogo.querySelector("#locke-crear").addEventListener("click", () => {
    dialogo.querySelector(".locke-error").textContent = "";
    crear().catch((error) => {
      console.error(error);
      dialogo.querySelector(".locke-error").textContent =
        error.code === "permission-denied"
          ? "Firebase no deja crear el locke. Falta publicar las reglas de Firestore."
          : "No se ha podido crear. Inténtalo otra vez.";
    });
  });

  lista.addEventListener("click", (e) => {
    const tarjeta = e.target.closest(".locke");
    const boton = e.target.closest("button");
    if (!tarjeta || !boton) return;

    const id = tarjeta.dataset.id;
    const jugador = e.target.closest(".locke-jugador");
    const locke = lockePorId(id);
    if (!locke) return;

    let tarea = null;

    if (boton.classList.contains("locke-invitar")) {
      tarea = abrirInvitar(id);
    } else if (boton.classList.contains("locke-borrar")) {
      if (confirm(`¿Borrar «${locke.nombre}»? Lo pierden todos los que juegan.`)) tarea = borrarLocke(id);
    } else if (boton.classList.contains("locke-ganador")) {
      const quien = (locke.nombres || {})[jugador.dataset.uid] || "ese jugador";
      if (confirm(`¿Cerrar «${locke.nombre}» con ${quien} como ganador?\n\nSe le sumará a sus lockes ganados y el locke dejará de poder editarse.`)) {
        tarea = elegirGanador(id, jugador.dataset.uid);
      }
    } else if (boton.classList.contains("mas")) {
      tarea = cambiarNumero(id, jugador.dataset.uid, boton.dataset.campo, 1);
    } else if (boton.classList.contains("menos")) {
      tarea = cambiarNumero(id, jugador.dataset.uid, boton.dataset.campo, -1);
    }

    if (tarea) {
      tarea.catch((error) => {
        console.error(error);
        aviso.textContent = "No se ha podido guardar el cambio.";
      });
    }
  });

  alCambiarLockes(pintar);
}

export function mostrar() {
  pintar();
}
