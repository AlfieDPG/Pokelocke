// Sección «Amigos».
//
// Una ficha por persona con su palmarés: la tuya y las de los amigos que te han aceptado.
// Nadie más sale: hasta que mandas una solicitud y te la aceptan, aquí solo estás tú.
//
// Nadie puede editar la ficha de otro. Tú editas la tuya: los tipos de locke que usas y
// tu palmarés. Lo que ganes en «Versus» se apunta solo.
//
// Los lockes de antes de que existieran las cuentas (js/comun/legado.js) se pueden traer
// de una vez desde el diálogo del palmarés.

import { imagenConRespaldo } from "../comun/imagenes.js";
import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import { hayNube, usuarioActual } from "../comun/nube.js";
import { LEGADO, TIPOS_LEGADO } from "../comun/legado.js";
import {
  TIPOS_POR_DEFECTO, alCambiarMiPerfil, alCambiarAmistades, miPerfil, fallaElPerfil, tiposDe, tiposParaFicha,
  amigosAceptados, solicitudesRecibidas, solicitudesEnviadas, fallaLasAmistades,
  perfilesDe, buscarPorCorreo, pedirAmistad, aceptarAmistad, borrarAmistad,
  guardarMiPerfil, nuevoId
} from "../comun/perfiles.js";

let seccion = null;
let lista = null;
let solicitudes = null;
let aviso = null;
let campoCorreo = null;
let dialogoTipos = null;
let dialogoPalmares = null;

// ---------- Colores ----------

// El color va dentro de un atributo style, así que solo se deja pasar #rrggbb.
// Si alguien guardase cualquier otra cosa en su perfil, aquí se queda fuera.
function colorSeguro(color) {
  return /^#[0-9a-f]{6}$/i.test(String(color || "")) ? color : "#3498db";
}

// ---------- Plantillas ----------

function etiquetaTipo(nombre, total) {
  if (total === 1 || /s$/i.test(nombre)) return nombre;
  return `${nombre}s`;
}

function plantillaContador(tipo, total) {
  return `
    <div class="contador-locke" style="--color-locke: ${colorSeguro(tipo.color)}">
      <span class="contador-numero">${total}</span>
      <span class="contador-tipo">${escaparHTML(etiquetaTipo(tipo.nombre, total))}</span>
    </div>`;
}

function plantillaLocke(ganado) {
  const tipo = ganado.tipo || TIPOS_POR_DEFECTO[0];
  return `
    <li class="locke-ganado" style="--color-locke: ${colorSeguro(tipo.color)}"
        title="${escaparHTML(tipo.nombre)}">
      <span class="locke-nombre">${escaparHTML(ganado.nombre)}</span>
      ${ganado.nota ? `<span class="locke-nota">${escaparHTML(ganado.nota)}</span>` : ""}
    </li>`;
}

// Botones de la esquina. No plegan la ficha: lo para el oyente del click.
function plantillaAcciones(ficha) {
  if (ficha.mia) {
    return `
      <div class="ficha-acciones">
        <button class="accion-tipos" title="Tipos de locke">${icono("etiqueta")}</button>
        <button class="accion-palmares" title="Editar mis lockes ganados">${icono("lapiz")}</button>
      </div>`;
  }

  return `
    <div class="ficha-acciones">
      <button class="accion-quitar" title="Quitar de amigos">${icono("aspa")}</button>
    </div>`;
}

function plantillaFicha(ficha) {
  const alt = escaparHTML(ficha.nombre);

  // La dirección de la foto se escapa igual que el resto: viene del perfil de otra
  // persona y acaba dentro de un atributo. Las entidades (&amp;) las deshace el navegador.
  const urls = ficha.urls.map(escaparHTML);
  const imagen = urls.length
    ? imagenConRespaldo(urls, `alt="${alt}" draggable="false" referrerpolicy="no-referrer" data-quitar-si-falla`)
    : "";

  const tipos = ficha.tipos
    .map((tipo) => plantillaContador(tipo, ficha.ganados.filter((g) => g.tipo && g.tipo.id === tipo.id).length))
    .join("");

  return `
    <article class="ficha-jugador plegada ${ficha.mia ? "mia" : ""}"
             draggable="true" data-clave="${escaparHTML(ficha.clave)}"
             title="Pulsa para ver los lockes">
      ${plantillaAcciones(ficha)}
      <div class="jugador-foto" data-inicial="${escaparHTML(ficha.nombre[0] || "?")}">${imagen}</div>
      <h2 class="jugador-nombre">${alt}</h2>
      ${ficha.mia ? `<span class="jugador-etiqueta">Tú</span>` : ""}

      <div class="contadores-locke">${tipos}</div>

      <ul class="lockes-ganados">${ficha.ganados.map(plantillaLocke).join("")}</ul>
    </article>`;
}

// ---------- Armar la lista de fichas ----------

function fichaDePerfil(perfil, mia) {
  return {
    clave: perfil.uid,
    nombre: perfil.nombre || "Jugador",
    urls: [perfil.foto].filter(Boolean),
    tipos: tiposParaFicha(perfil),
    ganados: perfil.ganados || [],
    mia
  };
}

async function recargar() {
  const mio = hayNube() && usuarioActual() ? miPerfil() : null;

  // Sin sesión (o mientras el perfil llega) no hay nada que enseñar. Si no llega porque
  // Firestore no deja leerlo, eso sí se dice.
  if (!mio) {
    lista.innerHTML = "";
    solicitudes.hidden = true;
    aviso.textContent = hayNube() && usuarioActual() ? fallaElPerfil() : "";
    return;
  }

  aviso.textContent = fallaLasAmistades();

  const aceptados = amigosAceptados();
  const pendientes = [...solicitudesRecibidas(), ...solicitudesEnviadas()];
  const perfiles = await perfilesDe([...aceptados, ...pendientes].map((amistad) => amistad.otro));

  const fichas = [fichaDePerfil(mio, true)];
  for (const amistad of aceptados) {
    const perfil = perfiles.get(amistad.otro);
    if (perfil) fichas.push(fichaDePerfil(perfil, false));
  }

  lista.innerHTML = fichas.map(plantillaFicha).join("");
  pintarSolicitudes(pendientes, perfiles);
}

// La misma tira que el buzón del panel lateral, pero aquí al lado del buscador: lo que
// estás mirando cuando agregas a alguien es justo esto.
function pintarSolicitudes(pendientes, perfiles) {
  const usuario = usuarioActual();

  solicitudes.innerHTML = pendientes
    .map((amistad) => {
      const perfil = perfiles.get(amistad.otro);
      const nombre = escaparHTML((perfil && perfil.nombre) || "Alguien");

      if (amistad.pidio === usuario.uid) {
        return `
          <div class="solicitud" data-amistad="${escaparHTML(amistad.id)}">
            <span>Esperando a <b>${nombre}</b></span>
            <button class="solicitud-cancelar" title="Cancelar">${icono("aspa")}</button>
          </div>`;
      }

      return `
        <div class="solicitud entrante" data-amistad="${escaparHTML(amistad.id)}">
          <span><b>${nombre}</b> quiere ser tu amigo</span>
          <button class="solicitud-aceptar" title="Aceptar">${icono("visto")}</button>
          <button class="solicitud-rechazar" title="Rechazar">${icono("aspa")}</button>
        </div>`;
    })
    .join("");

  solicitudes.hidden = pendientes.length === 0;
}

// ---------- Agregar un amigo ----------

async function agregar() {
  const correo = campoCorreo.value.trim();
  if (!correo) return;

  const usuario = usuarioActual();
  if (!usuario) {
    aviso.textContent = "Primero inicia sesión.";
    return;
  }

  if (correo.toLowerCase() === (usuario.email || "").toLowerCase()) {
    aviso.textContent = "Ese eres tú.";
    return;
  }

  aviso.textContent = "Buscando...";

  try {
    const perfil = await buscarPorCorreo(correo);
    if (!perfil) {
      aviso.textContent = "Nadie con ese correo. Tiene que entrar una vez en la web primero.";
      return;
    }

    await pedirAmistad(perfil.uid);
    campoCorreo.value = "";
    aviso.textContent = `Solicitud enviada a ${perfil.nombre}.`;
    await recargar();
  } catch (error) {
    console.error(error);
    aviso.textContent = "No se ha podido. Inténtalo otra vez.";
  }
}

// ---------- Diálogo de tipos de locke ----------

let tiposEnEdicion = [];

function pintarTipos() {
  const cuerpo = dialogoTipos.querySelector(".tipos-lista");

  cuerpo.innerHTML = tiposEnEdicion
    .map(
      (tipo, posicion) => `
        <div class="fila-tipo" data-posicion="${posicion}">
          <input class="tipo-color" type="color" value="${colorSeguro(tipo.color)}" title="Color">
          <input class="tipo-nombre" type="text" value="${escaparHTML(tipo.nombre)}" placeholder="Nombre del tipo">
          <button class="tipo-quitar" title="Quitar">${icono("aspa")}</button>
        </div>`
    )
    .join("");
}

function abrirTipos() {
  const mio = miPerfil();
  tiposEnEdicion = tiposDe(mio).map((tipo) => ({ ...tipo }));
  pintarTipos();
  dialogoTipos.showModal();
}

async function guardarTipos() {
  const filas = [...dialogoTipos.querySelectorAll(".fila-tipo")];

  const tipos = filas
    .map((fila, posicion) => ({
      id: tiposEnEdicion[posicion].id,
      nombre: fila.querySelector(".tipo-nombre").value.trim(),
      color: colorSeguro(fila.querySelector(".tipo-color").value)
    }))
    .filter((tipo) => tipo.nombre);

  await guardarMiPerfil({ tipos });
  dialogoTipos.close();
}

// ---------- Diálogo de lockes ganados ----------

let ganadosEnEdicion = [];

// Tipos que ha traído el atajo de los lockes de antes (Megalocke, Bebelocke...) y que la
// cuenta todavía no tenía. Al guardar se añaden a sus tipos para poder usarlos después.
let tiposTraidos = [];

// Los tipos que se ofrecen en cada fila: los míos, los que vengan del atajo y los que ya
// estén en la lista aunque los haya borrado de mis tipos.
function tiposDelDialogo() {
  const mios = tiposDe(miPerfil());
  const ids = new Set(mios.map((tipo) => tipo.id));
  const tipos = [...mios, ...tiposTraidos.filter((tipo) => !ids.has(tipo.id))];
  return tiposParaFicha({ tipos, ganados: ganadosEnEdicion });
}

// Atajo para no escribir a mano los lockes de antes de que hubiera cuentas. Solo sale
// mientras la lista está vacía: una vez traídos, se editan como todo lo demás.
function pintarLegado() {
  const caja = dialogoPalmares.querySelector(".palmares-legado");
  const conLockes = LEGADO.filter((jugador) => jugador.lockes.length);

  caja.hidden = ganadosEnEdicion.length > 0;
  if (caja.hidden) return;

  caja.innerHTML = `
    <span>Traer los lockes de antes:</span>
    ${conLockes
      .map(
        (jugador) =>
          `<button class="palmares-traer" data-clave="${escaparHTML(jugador.clave)}">
             ${escaparHTML(jugador.nombre)} (${jugador.lockes.length})
           </button>`
      )
      .join("")}`;
}

function traerLegado(clave) {
  const jugador = LEGADO.find((cada) => cada.clave === clave);
  if (!jugador) return;

  ganadosEnEdicion = jugador.lockes.map((locke) => ({
    id: nuevoId(),
    nombre: locke.nombre,
    nota: locke.nota || "",
    tipo: TIPOS_LEGADO.find((tipo) => tipo.id === locke.tipo) || TIPOS_LEGADO[0]
  }));

  const usados = new Set(jugador.lockes.map((locke) => locke.tipo));
  tiposTraidos = TIPOS_LEGADO.filter((tipo) => usados.has(tipo.id));

  pintarPalmares();
}

function pintarPalmares() {
  const cuerpo = dialogoPalmares.querySelector(".palmares-lista");
  const tipos = tiposDelDialogo();

  pintarLegado();

  cuerpo.innerHTML = ganadosEnEdicion
    .map((ganado, posicion) => {
      const elegido = ganado.tipo ? ganado.tipo.id : "";
      const opciones = tipos
        .map(
          (tipo) =>
            `<option value="${escaparHTML(tipo.id)}" ${tipo.id === elegido ? "selected" : ""}>${escaparHTML(tipo.nombre)}</option>`
        )
        .join("");

      return `
        <div class="fila-palmares" data-posicion="${posicion}">
          <input class="palmares-nombre" type="text" value="${escaparHTML(ganado.nombre)}" placeholder="Juego o nombre del locke">
          <select class="palmares-tipo">${opciones}</select>
          <input class="palmares-nota" type="text" value="${escaparHTML(ganado.nota || "")}" placeholder="Nota (opcional)">
          <button class="palmares-quitar" title="Quitar">${icono("aspa")}</button>
        </div>`;
    })
    .join("");
}

function abrirPalmares() {
  const mio = miPerfil();
  ganadosEnEdicion = (mio.ganados || []).map((ganado) => ({ ...ganado }));
  tiposTraidos = [];
  pintarPalmares();
  dialogoPalmares.showModal();
}

async function guardarPalmares() {
  const tipos = tiposDelDialogo();
  const filas = [...dialogoPalmares.querySelectorAll(".fila-palmares")];

  const ganados = filas
    .map((fila, posicion) => {
      const idTipo = fila.querySelector(".palmares-tipo").value;
      return {
        id: ganadosEnEdicion[posicion].id || nuevoId(),
        nombre: fila.querySelector(".palmares-nombre").value.trim(),
        nota: fila.querySelector(".palmares-nota").value.trim(),
        tipo: tipos.find((tipo) => tipo.id === idTipo) || tipos[0]
      };
    })
    .filter((ganado) => ganado.nombre);

  const cambios = { ganados };

  // Si el atajo ha traído tipos que no tenía (Megalocke, Bebelocke), se quedan en mis tipos
  const mios = tiposDe(miPerfil());
  const ids = new Set(mios.map((tipo) => tipo.id));
  const nuevos = tiposTraidos.filter((tipo) => !ids.has(tipo.id));
  if (nuevos.length) cambios.tipos = [...mios, ...nuevos];

  await guardarMiPerfil(cambios);
  tiposTraidos = [];
  dialogoPalmares.close();
}

// ---------- Mover las fichas de sitio ----------
//
// Solo cambia el orden en pantalla y no se guarda: al recargar vuelven en el mismo orden.

let arrastrada = null;
let seAcabaDeArrastrar = false;

function fichaMasCercana(x, y) {
  let mejor = null;
  let menorDistancia = Infinity;

  for (const ficha of lista.querySelectorAll(".ficha-jugador:not(.arrastrando)")) {
    const caja = ficha.getBoundingClientRect();
    const dx = x - (caja.left + caja.width / 2);
    const dy = y - (caja.top + caja.height / 2);
    const distancia = dx * dx + dy * dy;

    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      mejor = ficha;
    }
  }

  return mejor;
}

function activarArrastre() {
  lista.addEventListener("dragstart", (e) => {
    arrastrada = e.target.closest(".ficha-jugador");
    if (!arrastrada) return;
    arrastrada.classList.add("arrastrando");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ""); // Firefox no arranca el arrastre sin esto
  });

  lista.addEventListener("dragover", (e) => {
    if (!arrastrada) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const destino = fichaMasCercana(e.clientX, e.clientY);
    if (!destino || destino === arrastrada) return;

    // A la izquierda de su centro se coloca delante; a la derecha, detrás
    const caja = destino.getBoundingClientRect();
    const detras = e.clientX > caja.left + caja.width / 2;
    lista.insertBefore(arrastrada, detras ? destino.nextSibling : destino);
  });

  lista.addEventListener("drop", (e) => e.preventDefault());

  lista.addEventListener("dragend", () => {
    if (arrastrada) arrastrada.classList.remove("arrastrando");
    arrastrada = null;
    seAcabaDeArrastrar = true; // el navegador puede soltar un click justo después
    setTimeout(() => (seAcabaDeArrastrar = false), 0);
  });
}

// ---------- Clicks en las fichas ----------

function activarFichas() {
  lista.addEventListener("click", async (e) => {
    if (seAcabaDeArrastrar) return;

    const ficha = e.target.closest(".ficha-jugador");
    if (!ficha) return;

    const boton = e.target.closest("button");
    if (!boton) {
      ficha.classList.toggle("plegada");
      return;
    }

    try {
      if (boton.classList.contains("accion-tipos")) abrirTipos();
      else if (boton.classList.contains("accion-palmares")) abrirPalmares();
      else if (boton.classList.contains("accion-quitar")) await quitarAmigo(ficha);
    } catch (error) {
      console.error(error);
      aviso.textContent = "No se ha podido. Inténtalo otra vez.";
    }
  });
}

async function quitarAmigo(ficha) {
  const nombre = ficha.querySelector(".jugador-nombre").textContent;
  if (!confirm(`¿Quitar a ${nombre} de tus amigos?`)) return;

  const amistad = amigosAceptados().find((cada) => cada.otro === ficha.dataset.clave);
  if (amistad) await borrarAmistad(amistad.id);
}

// ---------- Arranque ----------

export function iniciar() {
  seccion = document.querySelector("#vista-amigos");
  dialogoTipos = document.querySelector("#dialogo-tipos");
  dialogoPalmares = document.querySelector("#dialogo-palmares");
  lista = seccion.querySelector(".jugadores");
  solicitudes = seccion.querySelector(".amigos-solicitudes");
  aviso = seccion.querySelector(".amigos-aviso");
  campoCorreo = seccion.querySelector(".amigos-correo");

  seccion.querySelector(".barra-amigos").hidden = !hayNube();
  seccion.querySelector(".amigos-agregar").addEventListener("click", agregar);
  campoCorreo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") agregar();
  });

  activarArrastre();
  activarFichas();

  solicitudes.addEventListener("click", async (e) => {
    const fila = e.target.closest(".solicitud");
    const boton = e.target.closest("button");
    if (!fila || !boton) return;

    for (const cada of fila.querySelectorAll("button")) cada.disabled = true;

    try {
      if (boton.classList.contains("solicitud-aceptar")) await aceptarAmistad(fila.dataset.amistad);
      else await borrarAmistad(fila.dataset.amistad);
      // No hace falta repintar: el oyente de amistades lo hace al llegar el cambio
    } catch (error) {
      console.error(error);
      for (const cada of fila.querySelectorAll("button")) cada.disabled = false;
    }
  });

  // Diálogo de tipos
  dialogoTipos.querySelector(".tipos-anadir").addEventListener("click", () => {
    tiposEnEdicion = leerTiposDelDialogo();
    tiposEnEdicion.push({ id: nuevoId(), nombre: "", color: "#9b59b6" });
    pintarTipos();
  });
  dialogoTipos.querySelector(".tipos-lista").addEventListener("click", (e) => {
    const fila = e.target.closest(".fila-tipo");
    if (!e.target.closest(".tipo-quitar") || !fila) return;
    tiposEnEdicion = leerTiposDelDialogo();
    tiposEnEdicion.splice(Number(fila.dataset.posicion), 1);
    pintarTipos();
  });
  dialogoTipos.querySelector("#tipos-cancelar").addEventListener("click", () => dialogoTipos.close());
  dialogoTipos.querySelector("#tipos-guardar").addEventListener("click", guardarTipos);

  // Diálogo del palmarés
  dialogoPalmares.querySelector(".palmares-anadir").addEventListener("click", () => {
    ganadosEnEdicion = leerPalmaresDelDialogo();
    ganadosEnEdicion.push({ id: nuevoId(), nombre: "", nota: "", tipo: tiposDelDialogo()[0] });
    pintarPalmares();
  });
  dialogoPalmares.querySelector(".palmares-lista").addEventListener("click", (e) => {
    const fila = e.target.closest(".fila-palmares");
    if (!e.target.closest(".palmares-quitar") || !fila) return;
    ganadosEnEdicion = leerPalmaresDelDialogo();
    ganadosEnEdicion.splice(Number(fila.dataset.posicion), 1);
    pintarPalmares();
  });
  dialogoPalmares.querySelector(".palmares-legado").addEventListener("click", (e) => {
    const boton = e.target.closest(".palmares-traer");
    if (boton) traerLegado(boton.dataset.clave);
  });
  dialogoPalmares.querySelector("#palmares-cancelar").addEventListener("click", () => dialogoPalmares.close());
  dialogoPalmares.querySelector("#palmares-guardar").addEventListener("click", guardarPalmares);

  // Se repinta cuando cambia mi perfil (lo he editado yo o acabo de ganar un locke) y
  // cuando cambian las amistades (alguien me ha aceptado o me ha mandado una solicitud).
  const repintar = () => {
    if (!seccion.hidden) recargar().catch((error) => console.error(error));
  };

  alCambiarMiPerfil(repintar);
  alCambiarAmistades(repintar);
}

// Antes de repintar el diálogo hay que recoger lo escrito, que vive en los <input>
function leerTiposDelDialogo() {
  return [...dialogoTipos.querySelectorAll(".fila-tipo")].map((fila, posicion) => ({
    id: tiposEnEdicion[posicion].id,
    nombre: fila.querySelector(".tipo-nombre").value,
    color: colorSeguro(fila.querySelector(".tipo-color").value)
  }));
}

function leerPalmaresDelDialogo() {
  const tipos = tiposDelDialogo();

  return [...dialogoPalmares.querySelectorAll(".fila-palmares")].map((fila, posicion) => {
    const idTipo = fila.querySelector(".palmares-tipo").value;
    return {
      id: ganadosEnEdicion[posicion].id,
      nombre: fila.querySelector(".palmares-nombre").value,
      nota: fila.querySelector(".palmares-nota").value,
      tipo: tipos.find((tipo) => tipo.id === idTipo) || tipos[0]
    };
  });
}

export function mostrar() {
  aviso.textContent = "";
  recargar().catch((error) => {
    console.error(error);
    aviso.textContent = "No se han podido cargar los amigos.";
  });
}
