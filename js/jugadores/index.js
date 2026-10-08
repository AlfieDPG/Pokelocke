// Sección «Jugadores»: una ficha fija por jugador con sus lockes ganados.
// Contenido fijo e igual para todo el mundo: para añadir un jugador o un locke
// basta con editar JUGADORES (el orden de la lista es el orden en que se muestran).
//
// Tipos de locke (ver TIPOS): "locke" (azul), "mega" (amarillo) y "bebe" (rosa).
// La foto se busca en img/jugadores/<archivo> probando varias extensiones;
// si no hay ninguna, se muestra la inicial del nombre.

import { imagenConRespaldo } from "../comun/imagenes.js";

const TIPOS = {
  locke: { singular: "Locke", plural: "Lockes" },
  mega: { singular: "Megalocke", plural: "Megalockes" },
  bebe: { singular: "Bebelocke", plural: "Bebelockes" }
};

const JUGADORES = [
  {
    nombre: "Alfie",
    foto: "alfie",
    lockes: [
      { nombre: "Pokémon Ultrasol", tipo: "locke" },
      { nombre: "Pokémon Oro HeartGold", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Pokémon Rubí Omega", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Pokémon Platino", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Pokémon Y", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Megalocke 2025", tipo: "mega" },
      { nombre: "Pokémon Añil 2", tipo: "locke" },
      { nombre: "Pokémon Super Y", tipo: "locke" }
    ]
  },
  {
    nombre: "Pedro",
    foto: "pedro",
    lockes: [
      { nombre: "Pokémon X", tipo: "locke" },
      { nombre: "Pokémon Rubí Omega", tipo: "locke" },
      { nombre: "Bebelocke 1", tipo: "bebe" },
      { nombre: "Pokémon Añil", tipo: "locke" },
      { nombre: "Pokémon Blanco 2", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Pokémon Luna", tipo: "locke", nota: "Megalocke 2025" },
      { nombre: "Bebelocke 2", tipo: "bebe" }
    ]
  },
  { nombre: "Marc", foto: "marc", lockes: [] },
  { nombre: "Nico", foto: "nico", lockes: [] },
  { nombre: "Diego", foto: "diego", lockes: [] },
  { nombre: "Varo", foto: "varo", lockes: [] }
];

const EXTENSIONES = ["png", "jpg", "jpeg", "webp"];

function urlsFoto(foto) {
  return EXTENSIONES.map((extension) => `img/jugadores/${foto}.${extension}`);
}

function contar(lockes, tipo) {
  return lockes.filter((locke) => locke.tipo === tipo).length;
}

function plantillaContador(lockes, tipo) {
  const total = contar(lockes, tipo);
  return `
    <div class="contador-locke ${tipo}">
      <span class="contador-numero">${total}</span>
      <span class="contador-tipo">${total === 1 ? TIPOS[tipo].singular : TIPOS[tipo].plural}</span>
    </div>`;
}

function plantillaLocke({ nombre, tipo, nota }) {
  return `
    <li class="locke-ganado ${tipo}" title="${TIPOS[tipo].singular}">
      <span class="locke-nombre">${nombre}</span>
      ${nota ? `<span class="locke-nota">${nota}</span>` : ""}
    </li>`;
}

function plantillaJugador({ nombre, foto, lockes }) {
  // draggable="false" en la foto: si no, al arrastrar se lleva la imagen en vez de la ficha
  const imagen = imagenConRespaldo(urlsFoto(foto), `alt="${nombre}" draggable="false" data-quitar-si-falla`);
  return `
    <article class="ficha-jugador plegada" draggable="true" title="Pulsa para ver los lockes">
      <div class="jugador-foto" data-inicial="${nombre[0]}">${imagen}</div>
      <h2 class="jugador-nombre">${nombre}</h2>

      <div class="contadores-locke">
        ${Object.keys(TIPOS).map((tipo) => plantillaContador(lockes, tipo)).join("")}
      </div>

      <ul class="lockes-ganados">
        ${lockes.map(plantillaLocke).join("")}
      </ul>
    </article>`;
}

// ---------- Mover las fichas de sitio ----------
//
// Solo cambia el orden en pantalla y no se guarda: al recargar vuelve el orden de JUGADORES,
// así todo el mundo ve lo mismo al entrar.

let arrastrada = null;

function fichaMasCercana(lista, x, y) {
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

function activarArrastre(lista) {
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

    const destino = fichaMasCercana(lista, e.clientX, e.clientY);
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

// ---------- Plegar y desplegar ----------

let seAcabaDeArrastrar = false;

function activarPlegado(lista) {
  lista.addEventListener("click", (e) => {
    if (seAcabaDeArrastrar) return;
    const ficha = e.target.closest(".ficha-jugador");
    if (ficha) ficha.classList.toggle("plegada");
  });
}

export function iniciar() {
  const lista = document.querySelector("#vista-jugadores .jugadores");
  lista.innerHTML = JUGADORES.map(plantillaJugador).join("");
  activarArrastre(lista);
  activarPlegado(lista);
}

export function mostrar() {
  // contenido fijo: no hay nada que actualizar
}
