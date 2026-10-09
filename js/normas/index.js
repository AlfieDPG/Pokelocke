// Sección «Normas».
//
//   · Normas generales: las básicas de cualquier Nuzlocke, fijas.
//   · Mis normas: las tuyas. Se crean, se cambian y se borran aquí, y luego se eligen al
//     crear o editar un locke (los datos están en js/comun/normas.js).
//   · Arriba del todo, si se llega desde el botón «Normas» de un locke, las de ese locke.

import { icono } from "../comun/iconos.js";
import { escaparHTML } from "../comun/utilidades.js";
import {
  NORMAS_GENERALES, misNormas, guardarNorma, quitarNorma, alCambiarNormas
} from "../comun/normas.js";
import { alCambiarLockes, lockePorId } from "../comun/lockes.js";

let contenedor = null;
let dialogo = null;
let editando = null;   // id de la norma que se está cambiando, o null si es nueva
let idLocke = null;    // locke cuyas normas se enseñan arriba

// Para el botón «Normas» de cada locke (js/versus): se abre la sección con las suyas arriba
export function verNormasDeLocke(id) {
  idLocke = id;
}

function colorSeguro(color) {
  return /^#[0-9a-f]{6}$/i.test(String(color || "")) ? color : "#3498db";
}

function plantillaNorma(norma, editable) {
  const acciones = editable
    ? `
      <div class="norma-acciones">
        <button class="norma-editar" data-id="${escaparHTML(norma.id)}" title="Cambiar">${icono("lapiz")}</button>
        <button class="norma-borrar" data-id="${escaparHTML(norma.id)}" title="Borrar">${icono("papelera")}</button>
      </div>`
    : "";
  return `
    <li>
      <strong>${escaparHTML(norma.nombre)}</strong>
      ${norma.texto ? `<p>${escaparHTML(norma.texto)}</p>` : ""}
      ${acciones}
    </li>`;
}

function plantillaDelLocke() {
  const locke = idLocke ? lockePorId(idLocke) : null;
  if (!locke) return "";

  const normas = locke.normas || [];
  const tipo = locke.tipo || {};
  return `
    <section class="normas-grupo del-locke" style="--color-apartado: ${colorSeguro(tipo.color)}">
      <h2>
        ${icono("libro")} Normas de «${escaparHTML(locke.nombre)}»
        <button class="normas-cerrar-locke" title="Dejar de verlas">${icono("aspa")}</button>
      </h2>
      ${normas.length
        ? `<ul>${normas.map((norma) => plantillaNorma(norma, false)).join("")}</ul>`
        : `<p class="normas-vacio">Este locke no tiene normas elegidas. Quien lo creó puede ponérselas con el lápiz del locke.</p>`}
    </section>`;
}

function pintar() {
  const mias = misNormas();

  contenedor.innerHTML = `
    ${plantillaDelLocke()}

    <section class="normas-grupo generales">
      <h2>Normas generales</h2>
      <ul>${NORMAS_GENERALES.map((norma) => plantillaNorma(norma, false)).join("")}</ul>
    </section>

    <section class="normas-grupo mias">
      <h2>
        Mis normas
        <button class="normas-anadir">${icono("mas")} Nueva norma</button>
      </h2>
      ${mias.length
        ? `<ul>${mias.map((norma) => plantillaNorma(norma, true)).join("")}</ul>`
        : `<p class="normas-vacio">Todavía no tienes normas propias. Crea las de tu grupo con «Nueva norma» y elígelas al crear un locke.</p>`}
    </section>`;
}

// ---------- Ventana de crear / cambiar ----------

function abrirDialogo(norma = null) {
  editando = norma ? norma.id : null;
  dialogo.querySelector(".norma-titulo").textContent = norma ? "Cambiar norma" : "Nueva norma";
  dialogo.querySelector(".norma-nombre").value = norma ? norma.nombre : "";
  dialogo.querySelector(".norma-texto").value = norma ? norma.texto : "";
  dialogo.querySelector(".norma-error").textContent = "";
  dialogo.showModal();
  dialogo.querySelector(".norma-nombre").focus();
}

function guardarDesdeElDialogo() {
  const nombre = dialogo.querySelector(".norma-nombre").value.trim();
  const texto = dialogo.querySelector(".norma-texto").value.trim();
  const error = dialogo.querySelector(".norma-error");

  if (!nombre) {
    error.textContent = "Ponle un nombre.";
    return;
  }
  const repetida = misNormas().some(
    (norma) => norma.id !== editando && norma.nombre.trim().toLowerCase() === nombre.toLowerCase()
  );
  if (repetida) {
    error.textContent = "Ya tienes una norma con ese nombre.";
    return;
  }

  guardarNorma({ id: editando, nombre, texto });
  dialogo.close();
}

// ---------- Arranque ----------

export function iniciar() {
  contenedor = document.querySelector("#vista-normas .normas");
  dialogo = document.querySelector("#dialogo-norma");

  dialogo.querySelector(".norma-formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    guardarDesdeElDialogo();
  });
  dialogo.querySelector(".norma-cancelar").addEventListener("click", () => dialogo.close());

  contenedor.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;

    if (boton.classList.contains("normas-anadir")) {
      abrirDialogo();
    } else if (boton.classList.contains("normas-cerrar-locke")) {
      idLocke = null;
      pintar();
    } else if (boton.classList.contains("norma-editar")) {
      abrirDialogo(misNormas().find((norma) => norma.id === boton.dataset.id));
    } else if (boton.classList.contains("norma-borrar")) {
      const norma = misNormas().find((cada) => cada.id === boton.dataset.id);
      if (norma && confirm(`¿Borrar «${norma.nombre}» de tus normas?\n\nLos lockes que ya la tienen la conservan.`)) {
        quitarNorma(norma.id);
      }
    }
  });

  alCambiarNormas(pintar);
  // Si el locke de arriba cambia (le cambian las normas, lo borran...), al día
  alCambiarLockes(() => {
    if (idLocke) pintar();
  });
}

export function mostrar() {
  pintar();
  if (idLocke) contenedor.scrollIntoView({ block: "start" });
}
