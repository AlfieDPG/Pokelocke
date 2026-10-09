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
import { escaparHTML, fechaLarga } from "../comun/utilidades.js";
import {
  plantillaCampoJuego, activarCamposJuego, leerCampoJuego, nombreJuego
} from "../comun/campo-juego.js";
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

function plantillaLocke(ganado, posicion) {
  const tipo = ganado.tipo || TIPOS_POR_DEFECTO[0];
  return `
    <li class="locke-ganado" data-posicion="${posicion}" style="--color-locke: ${colorSeguro(tipo.color)}"
        title="Pulsa para ver los datos de este locke">
      <span class="locke-nombre">${escaparHTML(ganado.nombre)}</span>
      ${ganado.nota ? `<span class="locke-nota">${escaparHTML(ganado.nota)}</span>` : ""}
    </li>`;
}

// ---------- Recuadro con los datos de un locke ----------
//
// Al pulsar un locke de una ficha desplegada sale un recuadro flotante al lado: juego, cuándo
// terminó, quién ganó y quién jugó con cuántas vidas acabó. Todo sale de la copia que se
// guarda en el perfil (ver resumenDeLocke en perfiles.js): el locke original puede no ser
// legible para quien mira la ficha.

let fichasPintadas = new Map(); // clave de la ficha -> { nombre, ganados, mia }
let flotante = null;

function plantillaFlotante(ganado, ficha) {
  const tipo = ganado.tipo || TIPOS_POR_DEFECTO[0];
  const juego = nombreJuego(ganado);
  const fecha = fechaLarga(ganado.fechaFin);
  const ganador = ganado.ganador || ficha.nombre;
  const participantes = ganado.participantes || [];

  const filas = [];
  if (juego) filas.push(`<div class="flotante-fila">${icono("mando")}<span>${escaparHTML(juego)}</span></div>`);
  if (fecha) filas.push(`<div class="flotante-fila">${icono("calendario")}<span>Terminó el ${escaparHTML(fecha)}</span></div>`);
  filas.push(`<div class="flotante-fila ganador">${icono("corona")}<span>Ganó <b>${escaparHTML(ganador)}</b></span></div>`);

  const lista = participantes.length
    ? `
      <div class="flotante-titulo">Participantes</div>
      <ul class="flotante-participantes">
        ${participantes
          .map((p) => {
            // null: el locke era de vidas ilimitadas. "" o nada: no se apuntó.
            const vidas = p.vidas === null ? "∞" : p.vidas === "" || p.vidas === undefined ? "" : p.vidas;
            const gano = p.nombre === ganador;
            return `
              <li class="${gano ? "gano" : ""}">
                <span>${gano ? icono("corona") : ""}${escaparHTML(p.nombre)}</span>
                ${vidas === "" ? "" : `<span class="flotante-vidas">${icono("corazon")}${escaparHTML(vidas)}</span>`}
              </li>`;
          })
          .join("")}
      </ul>`
    : "";

  const sinDatos =
    !juego && !fecha && !participantes.length
      ? `<p class="flotante-vacio">${
          ficha.mia ? "Sin más datos. Puedes añadirlos con el lápiz de tu ficha." : "Sin más datos."
        }</p>`
      : "";

  return `
    <div class="flotante-cabecera">
      <span class="flotante-tipo">${escaparHTML(tipo.nombre)}</span>
      <span class="flotante-nombre">${escaparHTML(ganado.nombre)}</span>
    </div>
    ${ganado.nota ? `<p class="flotante-nota">${escaparHTML(ganado.nota)}</p>` : ""}
    ${filas.join("")}
    ${lista}
    ${sinDatos}`;
}

function cerrarFlotante() {
  if (!flotante) return;
  flotante.remove();
  flotante = null;
  for (const marcado of lista.querySelectorAll(".locke-ganado.abierto")) marcado.classList.remove("abierto");
}

function abrirFlotante(elemento, ganado, ficha) {
  const yaAbierto = elemento.classList.contains("abierto");
  cerrarFlotante();
  if (yaAbierto) return; // pulsar otra vez el mismo lo cierra

  const tipo = ganado.tipo || TIPOS_POR_DEFECTO[0];
  flotante = document.createElement("div");
  flotante.className = "flotante-locke";
  flotante.style.setProperty("--color-locke", colorSeguro(tipo.color));
  flotante.innerHTML = plantillaFlotante(ganado, ficha);
  document.body.appendChild(flotante);
  elemento.classList.add("abierto");

  // A la derecha del locke si cabe; si no, a la izquierda. Y sin salirse por abajo.
  const caja = elemento.getBoundingClientRect();
  const ancho = flotante.offsetWidth;
  const alto = flotante.offsetHeight;
  const margen = 12;

  let izquierda = caja.right + margen;
  if (izquierda + ancho > window.innerWidth - margen) izquierda = caja.left - ancho - margen;
  if (izquierda < margen) izquierda = Math.max(margen, Math.min(caja.left, window.innerWidth - ancho - margen));

  let arriba = caja.top;
  if (arriba + alto > window.innerHeight - margen) arriba = window.innerHeight - alto - margen;

  flotante.style.left = `${Math.round(izquierda)}px`;
  flotante.style.top = `${Math.round(Math.max(margen, arriba))}px`;
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

      <ul class="lockes-ganados">${ficha.ganados.map((ganado, i) => plantillaLocke(ganado, i)).join("")}</ul>
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

  cerrarFlotante();
  fichasPintadas = new Map(fichas.map((ficha) => [ficha.clave, ficha]));
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
          <div class="fila-palmares-principal">
            <input class="palmares-nombre" type="text" value="${escaparHTML(ganado.nombre)}" placeholder="Juego o nombre del locke">
            <select class="palmares-tipo">${opciones}</select>
            <input class="palmares-nota" type="text" value="${escaparHTML(ganado.nota || "")}" placeholder="Nota (opcional)">
            <button class="palmares-quitar" title="Quitar">${icono("aspa")}</button>
          </div>
          ${plantillaDetalles(ganado)}
        </div>`;
    })
    .join("");
}

// Lo que sale en el recuadro al pulsar el locke en la ficha. Plegado por defecto para que la
// lista no sea eterna; el resumen del <summary> dice lo que ya hay apuntado.
function plantillaDetalles(ganado) {
  const participantes = ganado.participantes || [];
  const resumen = [
    nombreJuego(ganado),
    fechaLarga(ganado.fechaFin),
    participantes.length ? `${participantes.length} participante${participantes.length === 1 ? "" : "s"}` : ""
  ].filter(Boolean);

  const filas = participantes
    .map(
      (p) => `
        <div class="participante">
          <input class="participante-nombre" type="text" value="${escaparHTML(p.nombre || "")}" placeholder="Nombre">
          <span class="participante-corazon">${icono("corazon")}</span>
          <input class="participante-vidas" type="number" min="0" max="999"
            value="${p.vidas === null || p.vidas === undefined ? "" : escaparHTML(p.vidas)}"
            placeholder="${p.vidas === null ? "∞" : "Vidas"}" title="Vidas con las que acabó">
          <button class="participante-quitar" title="Quitar">${icono("aspa")}</button>
        </div>`
    )
    .join("");

  return `
    <details class="palmares-mas" ${ganado.abierto ? "open" : ""}>
      <summary>
        Juego, fecha y participantes
        ${resumen.length ? `<span class="palmares-resumen">· ${escaparHTML(resumen.join(" · "))}</span>` : ""}
      </summary>
      <div class="palmares-detalles">
        <div class="palmares-campo">
          <span>Juego</span>
          ${plantillaCampoJuego(ganado)}
        </div>
        <label class="palmares-campo">
          <span>Terminó el</span>
          <input class="palmares-fecha" type="date" value="${escaparHTML(ganado.fechaFin || "")}">
        </label>
        <div class="palmares-campo participantes">
          <span>Participantes y vidas con las que acabaron</span>
          ${filas}
          <button class="participante-anadir">${icono("mas")} Añadir participante</button>
        </div>
      </div>
    </details>`;
}

// Una fila del diálogo tal y como está escrita ahora mismo. «abierto» solo sirve para que
// los detalles sigan desplegados al repintar; no se guarda.
function leerFila(fila, posicion, tipos) {
  const idTipo = fila.querySelector(".palmares-tipo").value;
  const anterior = ganadosEnEdicion[posicion] || {};

  return {
    ...anterior, // conserva lo que no se edita aquí (el ganador de los de Versus)
    id: anterior.id || nuevoId(),
    nombre: fila.querySelector(".palmares-nombre").value,
    nota: fila.querySelector(".palmares-nota").value,
    tipo: tipos.find((tipo) => tipo.id === idTipo) || tipos[0],
    ...leerCampoJuego(fila.querySelector(".campo-juego")),
    fechaFin: fila.querySelector(".palmares-fecha").value,
    participantes: [...fila.querySelectorAll(".participante")].map((p) => {
      const vidas = p.querySelector(".participante-vidas");
      return {
        nombre: p.querySelector(".participante-nombre").value,
        // Vacío: si venía de un locke con vidas ilimitadas (null) se respeta; si no, ""
        vidas: vidas.value === "" ? (vidas.placeholder === "∞" ? null : "") : Number(vidas.value)
      };
    }),
    abierto: fila.querySelector(".palmares-mas").open
  };
}

function abrirPalmares() {
  const mio = miPerfil();
  ganadosEnEdicion = (mio.ganados || []).map((ganado) => ({ ...ganado }));
  tiposTraidos = [];
  pintarPalmares();
  dialogoPalmares.showModal();
}

async function guardarPalmares() {
  const ganados = leerPalmaresDelDialogo()
    .map(({ abierto, ...ganado }) => ({
      ...ganado,
      nombre: ganado.nombre.trim(),
      nota: ganado.nota.trim(),
      juegoOtro: ganado.juegoOtro.trim(),
      participantes: ganado.participantes
        .map((p) => ({ ...p, nombre: p.nombre.trim() }))
        .filter((p) => p.nombre)
    }))
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

    // Un locke de la lista: abre sus datos sin plegar la ficha
    const locke = e.target.closest(".locke-ganado");
    if (locke) {
      const datos = fichasPintadas.get(ficha.dataset.clave);
      const ganado = datos && datos.ganados[Number(locke.dataset.posicion)];
      if (ganado) abrirFlotante(locke, ganado, datos);
      return;
    }

    const boton = e.target.closest("button");
    if (!boton) {
      cerrarFlotante();
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

  // El recuadro de datos de un locke se cierra al pulsar fuera, con Escape o al moverse
  document.addEventListener("click", (e) => {
    if (!flotante || flotante.contains(e.target) || e.target.closest(".locke-ganado")) return;
    cerrarFlotante();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarFlotante();
  });
  window.addEventListener("scroll", cerrarFlotante, true);
  window.addEventListener("resize", cerrarFlotante);
  lista.addEventListener("dragstart", cerrarFlotante);

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
    const boton = e.target.closest("button");
    if (!fila || !boton) return;

    const posicion = Number(fila.dataset.posicion);

    // Siempre se recoge lo escrito antes de repintar, o se perdería
    if (boton.classList.contains("palmares-quitar")) {
      ganadosEnEdicion = leerPalmaresDelDialogo();
      ganadosEnEdicion.splice(posicion, 1);
    } else if (boton.classList.contains("participante-anadir")) {
      ganadosEnEdicion = leerPalmaresDelDialogo();
      ganadosEnEdicion[posicion].participantes.push({ nombre: "", vidas: "" });
    } else if (boton.classList.contains("participante-quitar")) {
      const cual = [...fila.querySelectorAll(".participante")].indexOf(boton.closest(".participante"));
      ganadosEnEdicion = leerPalmaresDelDialogo();
      ganadosEnEdicion[posicion].participantes.splice(cual, 1);
    } else {
      return;
    }

    pintarPalmares();
  });
  activarCamposJuego(dialogoPalmares);
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
  return [...dialogoPalmares.querySelectorAll(".fila-palmares")].map((fila, posicion) =>
    leerFila(fila, posicion, tipos)
  );
}

export function mostrar() {
  aviso.textContent = "";
  recargar().catch((error) => {
    console.error(error);
    aviso.textContent = "No se han podido cargar los amigos.";
  });
}
