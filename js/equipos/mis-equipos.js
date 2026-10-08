import {
  estado, leerGuardados, escribirGuardados, reordenarGuardados, guardarActual, hayCambiosSinGuardar, reemplazarEquipo
} from "./estado.js";
import { leer, escribir } from "../comun/almacen.js";
import { icono } from "../comun/iconos.js";
import { copiaProfunda } from "../comun/utilidades.js";
import { imagenConRespaldo, urlsPMD, urlSpriteHome } from "../comun/imagenes.js";
import { textoForma } from "../comun/pokemon.js";
import { pasteDelEquipo, copiarAlPortapapeles } from "./exportar.js";
import { irA } from "../navegacion.js";

const lista = document.getElementById("lista-equipos");

// ---------- Tarjetas o lista ----------

const CLAVE_VISTA = "poketeams-equipos-vista-v1";
const boton = document.getElementById("cambiar-vista");

function aplicarVista(enLista) {
  lista.classList.toggle("modo-lista", enLista);
  boton.textContent = enLista ? "Ver en tarjetas" : "Ver en lista";
}

boton.addEventListener("click", () => {
  const enLista = !lista.classList.contains("modo-lista");
  escribir(CLAVE_VISTA, enLista);
  aplicarVista(enLista);
});

aplicarVista(leer(CLAVE_VISTA, false));

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

async function exportarEquipo(guardado, boton) {
  const copiado = await copiarAlPortapapeles(pasteDelEquipo(guardado.pokemon));

  boton.innerHTML = icono(copiado ? "visto" : "aspa");
  boton.title = copiado ? "Copiado al portapapeles" : "No se pudo copiar";
  boton.disabled = true;
  setTimeout(() => {
    boton.innerHTML = icono("copiar");
    boton.title = "Copiar el equipo como paste";
    boton.disabled = false;
  }, 1500);
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

  seAcabaDeArrastrar = true; // soltar la tarjeta no debe contar como clic para abrirla
  setTimeout(() => (seAcabaDeArrastrar = false), 0);
});

let seAcabaDeArrastrar = false;

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
          <button class="exportar" title="Copiar el equipo como paste" aria-label="Exportar">${icono("copiar")}</button>
          <button class="borrar" title="Borrar el equipo" aria-label="Borrar">${icono("papelera")}</button>
        </div>
      </div>
      <div class="equipo-miniaturas">${miniaturas}</div>
    `;

    tarjeta.querySelector("h3").textContent = guardado.nombre;
    tarjeta.title = "Pulsa para abrir este equipo";

    // Se abre pulsando en la tarjeta, menos si el clic ha sido en uno de sus botones
    tarjeta.addEventListener("click", (e) => {
      if (seAcabaDeArrastrar || e.target.closest("button")) return;
      abrirEquipo(guardado);
    });

    const botonExportar = tarjeta.querySelector(".exportar");
    botonExportar.addEventListener("click", () => exportarEquipo(guardado, botonExportar));
    tarjeta.querySelector(".borrar").addEventListener("click", () => borrarEquipo(guardado));

    lista.appendChild(tarjeta);
  }
}
