// ---------- Elegir en qué juego es un locke ----------
//
// Un desplegable con los juegos que tienen Rutas y Level caps en la web (agrupados por
// región, igual que en esas secciones) y, al final, «Otro (fan game)», que abre una casilla
// de texto para escribirlo a mano.
//
// Se guarda así:
//   { juego: "frlg", juegoOtro: "" }                  un juego de la web
//   { juego: "", juegoOtro: "Pokémon Añil Fusión" }   otro escrito a mano
//   { juego: "", juegoOtro: "" }                      sin decir

import { REGIONES, JUEGOS } from "./juegos.js";
import { escaparHTML } from "./utilidades.js";

const OTRO = "__otro";

export function juegoRegistrado(id) {
  return JUEGOS.find((juego) => juego.id === id) || null;
}

// Nombre para enseñar, o "" si no se dijo
export function nombreJuego(datos) {
  if (!datos) return "";
  const registrado = juegoRegistrado(datos.juego);
  if (registrado) return `Pokémon ${registrado.nombre}`.replace("Pokémon Pokémon", "Pokémon");
  return datos.juegoOtro || "";
}

// HTML del desplegable y la casilla de «otro». «clase» distingue un campo de otro cuando
// hay varios en la misma ventana (una fila por locke).
export function plantillaCampoJuego(datos = {}, clase = "") {
  const elegido = datos.juego || (datos.juegoOtro ? OTRO : "");

  const grupos = REGIONES.filter((region) => JUEGOS.some((juego) => juego.region === region.id))
    .map(
      (region) => `
        <optgroup label="${escaparHTML(region.nombre)}">
          ${JUEGOS.filter((juego) => juego.region === region.id)
            .map(
              (juego) =>
                `<option value="${juego.id}" ${juego.id === elegido ? "selected" : ""}>${escaparHTML(juego.nombre)}</option>`
            )
            .join("")}
        </optgroup>`
    )
    .join("");

  return `
    <span class="campo-juego ${clase}">
      <select class="juego-select">
        <option value="" ${elegido ? "" : "selected"}>Sin decir</option>
        ${grupos}
        <option value="${OTRO}" ${elegido === OTRO ? "selected" : ""}>Otro (fan game...)</option>
      </select>
      <input class="juego-otro" type="text" placeholder="¿Qué juego?"
        value="${escaparHTML(datos.juegoOtro || "")}" ${elegido === OTRO ? "" : "hidden"}>
    </span>`;
}

// La casilla de texto solo se ve con «Otro». Un oyente en el contenedor sirve para todos
// los campos de juego que tenga dentro, aunque se vuelvan a pintar.
export function activarCamposJuego(contenedor) {
  contenedor.addEventListener("change", (e) => {
    const select = e.target.closest(".juego-select");
    if (!select) return;
    const otro = select.parentElement.querySelector(".juego-otro");
    otro.hidden = select.value !== OTRO;
    if (!otro.hidden) otro.focus();
  });
}

export function leerCampoJuego(campo) {
  const valor = campo.querySelector(".juego-select").value;
  if (valor === OTRO) return { juego: "", juegoOtro: campo.querySelector(".juego-otro").value.trim() };
  return { juego: valor, juegoOtro: "" };
}
