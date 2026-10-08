import {
  estado, leerGuardados, escribirGuardados, reordenarGuardados, guardarActual, hayCambiosSinGuardar, reemplazarEquipo
} from "./estado.js";
import { copiaProfunda } from "../comun/utilidades.js";
import { imagenConRespaldo, urlsPMD, urlSpriteHome } from "../comun/imagenes.js";
import { textoForma } from "../comun/pokemon.js";
import { irA } from "../navegacion.js";

const lista = document.getElementById("lista-equipos");

function abrirEquipo(guardado) {
  if (hayCambiosSinGuardar()) {
    const seguro = confirm(
      "Tienes cambios sin guardar en el equipo actual. ¿Abrir otro equipo y descartarlos?"
    );
    if (!seguro) return;
  }

  reemplazarEquipo(copiaProfunda(guardado.pokemon), guardado.nombre, guardado.id);
  irA("crear");
}

function borrarEquipo(guardado) {
  if (!confirm(`¿Borrar el equipo «${guardado.nombre}»?`)) return;

  escribirGuardados(leerGuardados().filter((g) => g.id !== guardado.id));

  if (estado.id === guardado.id) {
    estado.id = null;
    guardarActual();
  }

  renderMisEquipos();
}

// ---------- Reordenar arrastrando las tarjetas ----------

let arrastrada = null;

lista.addEventListener("dragstart", (e) => {
  arrastrada = e.target.closest(".equipo-guardado");
  if (!arrastrada) return;
  arrastrada.classList.add("arrastrando");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", arrastrada.dataset.id);
});

// Mientras se arrastra, la tarjeta se mueve delante o detrás de la que está debajo del ratón
lista.addEventListener("dragover", (e) => {
  if (!arrastrada) return;
  e.preventDefault();
  const destino = e.target.closest(".equipo-guardado");
  if (!destino || destino === arrastrada) return;

  // Con varias columnas cuenta la mitad izquierda/derecha; con una sola, la de arriba/abajo
  const r = destino.getBoundingClientRect();
  const columnas = getComputedStyle(lista).gridTemplateColumns.split(" ").length;
  const antes = columnas > 1 ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;

  if (antes) destino.before(arrastrada);
  else destino.after(arrastrada);
});

lista.addEventListener("drop", (e) => e.preventDefault());

lista.addEventListener("dragend", () => {
  if (!arrastrada) return;
  arrastrada.classList.remove("arrastrando");
  arrastrada = null;
  reordenarGuardados([...lista.querySelectorAll(".equipo-guardado")].map((t) => t.dataset.id));
});

export function renderMisEquipos() {
  const guardados = leerGuardados();
  lista.innerHTML = "";

  if (guardados.length === 0) {
    lista.innerHTML =
      "<p>Todavía no has guardado ningún equipo. Crea uno y pulsa «Guardar equipo».</p>";
    return;
  }

  for (const guardado of guardados) {
    const fecha = new Date(guardado.actualizado).toLocaleDateString("es-ES");

    // Retrato de Mundo Misterioso; si no existe, render HOME; si no, el icono antiguo
    const miniaturas = guardado.pokemon
      .map((p) =>
        imagenConRespaldo(
          [...urlsPMD(p), urlSpriteHome(p), p.sprite, p.imagen],
          `alt="${p.es}" title="${p.es}${textoForma(p) ? " (" + textoForma(p) + ")" : ""}" loading="lazy" decoding="async" draggable="false"`
        )
      )
      .join("");

    const tarjeta = document.createElement("div");
    tarjeta.className = "equipo-guardado";
    tarjeta.draggable = true;
    tarjeta.dataset.id = guardado.id;
    tarjeta.innerHTML = `
      <div class="equipo-cabecera">
        <div>
          <h3></h3>
          <span class="fecha">Guardado el ${fecha}</span>
        </div>
        <div class="equipo-botones">
          <button class="abrir">Abrir</button>
          <button class="borrar">Borrar</button>
        </div>
      </div>
      <div class="equipo-miniaturas">${miniaturas}</div>
    `;

    tarjeta.querySelector("h3").textContent = guardado.nombre;
    tarjeta.querySelector(".abrir").addEventListener("click", () => abrirEquipo(guardado));
    tarjeta.querySelector(".borrar").addEventListener("click", () => borrarEquipo(guardado));

    lista.appendChild(tarjeta);
  }
}
