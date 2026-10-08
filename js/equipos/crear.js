import {
  estado, MAX_EQUIPO, guardarEquipo, guardarActual, reemplazarEquipo, guardarEnMisEquipos, hayCambiosSinGuardar
} from "./estado.js";
import { datos } from "../comun/datos.js";
import { pedirJSON, URL_API } from "../comun/api.js";
import { coloresTipo, tiposEs, iconoTipo } from "../comun/tipos.js";
import { etiquetaForma, obtenerVariedades } from "../comun/formas.js";
import {
  pokemonDesdeAPI, ataqueDesdeAPI, obtenerStats, obtenerDatosCombate, descripcionHabilidad, descripcionObjeto, textoForma
} from "../comun/pokemon.js";
import { activarTooltips, actualizarTooltip, ocultarTooltip, escaparHTML } from "../comun/tooltip.js";
import { activarAutocompletado } from "../comun/autocompletado.js";
import {
  imagenConRespaldo, urlArte, urlsArte, urlsIconoObjeto, cambiarImagen, precargarEnReposo
} from "../comun/imagenes.js";

const resultado = document.getElementById("resultado");
const campoBuscar = document.getElementById("nombre");
const campoNombre = document.getElementById("nombre-equipo");
const contadorEl = document.getElementById("contador");
const avisoEl = document.getElementById("aviso");

// Mensaje en lugar de las tarjetas (cargando, error...)
export function mostrarMensaje(texto) {
  resultado.innerHTML = `<p>${texto}</p>`;
}

// ---------- Avisos ----------

let temporizadorAviso = null;

export function mostrarAviso(texto) {
  avisoEl.textContent = texto;
  clearTimeout(temporizadorAviso);
  if (texto) {
    temporizadorAviso = setTimeout(() => {
      avisoEl.textContent = "";
    }, 3000);
  }
}

// ---------- Elegir forma (Alola, Galar, Mega...) ----------

// Ventana para elegir la forma. Devuelve el nombre de la variedad o null si se cancela.
function elegirForma(entrada, info) {
  return new Promise((resolver) => {
    const dialogo = document.getElementById("dialogo-forma");
    const contenedor = document.getElementById("forma-opciones");
    let elegido = null;

    document.getElementById("forma-titulo").textContent = `¿Qué forma de ${entrada.es}?`;
    contenedor.innerHTML = "";

    for (const slug of info.lista) {
      const b = document.createElement("button");
      b.textContent = "Forma " + etiquetaForma(slug, info.especie);
      b.addEventListener("click", () => {
        elegido = slug;
        dialogo.close();
      });
      contenedor.appendChild(b);
    }

    document.getElementById("forma-cancelar").onclick = () => dialogo.close();
    dialogo.addEventListener("close", () => resolver(elegido), { once: true });
    dialogo.showModal();
  });
}

// ---------- Añadir Pokémon al equipo (búsqueda manual) ----------

async function agregarPokemon(entrada) {
  campoBuscar.value = "";

  if (estado.equipo.length >= MAX_EQUIPO) {
    mostrarAviso("El equipo ya tiene 6 Pokémon.");
    return;
  }

  mostrarAviso("Añadiendo...");

  try {
    let variedad = null;

    let info = { especie: "", lista: [] };
    try {
      info = await obtenerVariedades(entrada.id);
    } catch (error) {
      // sin formas: se añade la normal
    }

    // Si la especie tiene más formas (Alola, Mega...), se pregunta cuál
    if (info.lista.length > 1) {
      mostrarAviso("");
      variedad = await elegirForma(entrada, info);
      if (!variedad) return;
      mostrarAviso("Añadiendo...");
    }

    const p = await pedirJSON(`${URL_API}pokemon/${variedad || entrada.id}`);
    estado.equipo.push(await pokemonDesdeAPI(p, entrada));

    guardarEquipo();
    mostrarAviso("");
    renderCrear();
  } catch (error) {
    mostrarAviso("No he podido cargar ese Pokémon.");
  }
}

// ---------- Tarjetas ----------

const tarjetas = new WeakMap(); // Pokémon -> su tarjeta en pantalla
const pokemonDe = new WeakMap(); // tarjeta -> su Pokémon (para las fichas al pasar el ratón)

// Dibuja todas las tarjetas a partir de estado.equipo
export function renderCrear() {
  ocultarTooltip();
  if (campoNombre.value !== estado.nombre) campoNombre.value = estado.nombre;
  contadorEl.textContent = `Equipo: ${estado.equipo.length}/${MAX_EQUIPO}`;
  resultado.replaceChildren(...estado.equipo.map((poke) => crearTarjeta(poke)));

  // Deja descargada la otra versión (normal/shiny) de cada arte para que el cambio sea instantáneo
  precargarEnReposo(estado.equipo.map((p) => urlArte({ ...p, shiny: !p.shiny })));
}

// Vuelve a dibujar solo la tarjeta de ese Pokémon (las demás no se tocan)
function refrescarTarjeta(poke) {
  const vieja = tarjetas.get(poke);
  if (vieja && vieja.isConnected) {
    ocultarTooltip();
    vieja.replaceWith(crearTarjeta(poke));
  }
}

function crearTarjeta(poke) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta";
  tarjetas.set(poke, tarjeta);
  pokemonDe.set(tarjeta, poke);

  const chipsTipos = poke.tipos
    .map(
      (t) => `
        <span class="chip" style="background:${coloresTipo[t]}">
          ${iconoTipo(t)}
          ${tiposEs[t]}
        </span>`
    )
    .join("");

  const arte = imagenConRespaldo(urlsArte(poke), `class="arte" alt="${poke.es}"`);

  tarjeta.innerHTML = `
    <button class="btn-shiny ${poke.shiny ? "activo" : ""}" title="Shiny">${poke.shiny ? "★" : "☆"}</button>
    <div class="tarjeta-izq">
      ${arte}
      <h2>${poke.es}</h2>
      ${textoForma(poke) ? `<div class="forma-nombre">(${textoForma(poke)})</div>` : ""}
      <div class="chips">${chipsTipos}</div>
      <button class="quitar-pokemon">Quitar</button>
    </div>
    <div class="tarjeta-der">
      <div class="fila-superior">
        <div class="campo casilla-habilidad"></div>
        <div class="campo casilla-objeto"></div>
      </div>
      <div class="ataques"></div>
    </div>
  `;

  // Shiny: solo cambian el botón y la imagen; la imagen vieja se queda hasta que la nueva está lista
  const botonShiny = tarjeta.querySelector(".btn-shiny");
  botonShiny.addEventListener("click", () => {
    poke.shiny = !poke.shiny;
    guardarEquipo();
    botonShiny.classList.toggle("activo", poke.shiny);
    botonShiny.textContent = poke.shiny ? "★" : "☆";
    cambiarImagen(tarjeta.querySelector(".arte"), urlsArte(poke));
  });

  tarjeta.querySelector(".quitar-pokemon").addEventListener("click", () => {
    estado.equipo.splice(estado.equipo.indexOf(poke), 1);
    guardarEquipo();
    renderCrear();
  });

  pintarCasilla(
    tarjeta.querySelector(".casilla-habilidad"),
    poke.habilidad, "Habilidad", "Habilidad", datos.habilidades, "habilidad",
    (nuevo) => {
      poke.habilidad = nuevo;
      guardarEquipo();
      refrescarTarjeta(poke);
    }
  );

  pintarCasilla(
    tarjeta.querySelector(".casilla-objeto"),
    poke.objeto, "Objeto", "Objeto", datos.objetos, "objeto",
    (nuevo) => {
      poke.objeto = nuevo;
      guardarEquipo();
      refrescarTarjeta(poke);
    }
  );

  const contenedorAtaques = tarjeta.querySelector(".ataques");
  for (let i = 0; i < 4; i++) {
    const hueco = document.createElement("div");
    hueco.className = "hueco";
    contenedorAtaques.appendChild(hueco);
    pintarAtaque(hueco, poke, i);
  }

  return tarjeta;
}

// ---------- Habilidad y objeto (casillas con formato de tarjeta) ----------

function pintarCasilla(casilla, valor, placeholder, etiqueta, lista, clase, alCambiar) {
  if (valor) {
    const icono =
      clase === "objeto"
        ? imagenConRespaldo(urlsIconoObjeto(valor.en), `class="icono-objeto" alt="" data-quitar-si-falla`)
        : "";

    casilla.innerHTML = `
      <div class="ataque ${clase}">
        ${icono}
        <span class="ataque-nombre">${valor.es}</span>
        <span class="ataque-tipo">${etiqueta}</span>
        <button class="quitar" title="Cambiar">✕</button>
      </div>
    `;
    casilla.querySelector(".quitar").addEventListener("click", () => alCambiar(null));
  } else {
    casilla.innerHTML = `<input type="text" placeholder="${placeholder}">`;
    const campo = casilla.querySelector("input");
    activarAutocompletado(campo, lista, (entrada) => {
      alCambiar({ id: entrada.id, es: entrada.es, en: entrada.en });
    });
  }
}

// ---------- Ataques (búsqueda manual) ----------

function pintarAtaque(hueco, poke, i) {
  const ataque = poke.ataques[i];

  if (!ataque) {
    hueco.innerHTML = `<input type="text" placeholder="Ataque ${i + 1}">`;
    const campo = hueco.querySelector("input");

    activarAutocompletado(campo, datos.ataques, async (entrada) => {
      try {
        poke.ataques[i] = await ataqueDesdeAPI(entrada);
        guardarEquipo();
        refrescarTarjeta(poke);
      } catch (error) {
        campo.value = "";
        campo.placeholder = "No se pudo cargar, prueba otra vez";
      }
    });
    return;
  }

  // data-indice: para encontrar el ataque al pasar el ratón (ficha con la descripción)
  hueco.innerHTML = `
    <div class="ataque" style="background:${coloresTipo[ataque.tipo]}" data-indice="${i}">
      ${iconoTipo(ataque.tipo)}
      <span class="ataque-nombre">${ataque.es}</span>
      <span class="pp">
        <button class="menos">−</button>
        <span class="pp-valor">${ataque.pp}/${ataque.ppMax}</span>
        <button class="mas">+</button>
      </span>
      <button class="quitar" title="Cambiar ataque">✕</button>
    </div>
  `;

  const valor = hueco.querySelector(".pp-valor");

  hueco.querySelector(".menos").addEventListener("click", () => {
    if (ataque.pp > 0) ataque.pp--;
    valor.textContent = `${ataque.pp}/${ataque.ppMax}`;
    guardarEquipo();
  });

  hueco.querySelector(".mas").addEventListener("click", () => {
    if (ataque.pp < ataque.ppMax) ataque.pp++;
    valor.textContent = `${ataque.pp}/${ataque.ppMax}`;
    guardarEquipo();
  });

  hueco.querySelector(".quitar").addEventListener("click", () => {
    poke.ataques[i] = null;
    guardarEquipo();
    refrescarTarjeta(poke);
  });
}

// ---------- Fichas al pasar el ratón (stats base y descripción de ataques) ----------

const NOMBRES_STATS = ["PS", "Ataque", "Defensa", "At. Esp.", "Def. Esp.", "Velocidad"];

// Rojo (bajo) -> amarillo -> verde (alto). «bueno» es el valor a partir del cual ya es verde del todo.
function colorStat(valor, malo, bueno) {
  const proporcion = Math.min(1, Math.max(0, (valor - malo) / (bueno - malo)));
  return `hsl(${Math.round(proporcion * 120)}, 70%, 45%)`;
}

function filaStat(nombre, valor, maximo, malo, bueno, clase = "") {
  const ancho = Math.min(100, (valor / maximo) * 100);
  return `
    <div class="stat ${clase}">
      <span class="stat-nombre">${nombre}</span>
      <span class="stat-valor">${valor}</span>
      <span class="stat-barra"><span style="width:${ancho}%;background:${colorStat(valor, malo, bueno)}"></span></span>
    </div>`;
}

function fichaStats(poke) {
  const forma = textoForma(poke);
  const titulo = `${escaparHTML(poke.es)}${forma ? ` <small>(${escaparHTML(forma)})</small>` : ""}`;
  if (!poke.stats) {
    return `<div class="ficha ficha-stats"><div class="ficha-titulo">${titulo}</div><p>Cargando stats...</p></div>`;
  }

  const total = poke.stats.reduce((suma, v) => suma + v, 0);
  // Cada stat: la barra se llena hasta 180 y es verde del todo a partir de 130.
  // Total: se llena hasta 720 y es verde del todo a partir de 600.
  return `
    <div class="ficha ficha-stats">
      <div class="ficha-titulo">${titulo}</div>
      ${poke.stats.map((v, i) => filaStat(NOMBRES_STATS[i], v, 180, 30, 130)).join("")}
      ${filaStat("Total", total, 720, 250, 600, "stat-total")}
    </div>`;
}

function fichaAtaque(ataque) {
  return `
    <div class="ficha ficha-ataque" style="background:${coloresTipo[ataque.tipo]}">
      <div class="ficha-titulo">
        ${iconoTipo(ataque.tipo)}
        <span>${escaparHTML(ataque.es)}</span>
        <span class="ficha-tipo">${tiposEs[ataque.tipo]}</span>
      </div>
      <p>${escaparHTML(ataque.descripcion || "Sin descripción.")}</p>
      ${
        ataque.categoria
          ? `<div class="ficha-datos">
              <span>${ataque.categoria}</span>
              <span>Potencia: ${ataque.potencia || "—"}</span>
              <span>Precisión: ${ataque.precision ? ataque.precision + "%" : "—"}</span>
            </div>`
          : `<div class="ficha-datos"><span>Cargando potencia y precisión...</span></div>`
      }
    </div>`;
}

// Habilidad u objeto: ficha oscura con el nombre y la descripción
function fichaTexto(etiqueta, valor, icono = "") {
  return `
    <div class="ficha ficha-texto">
      <div class="ficha-titulo">${icono}<span>${escaparHTML(valor.es)}</span><span class="ficha-tipo">${etiqueta}</span></div>
      <p>${valor.descripcion === undefined ? "Cargando descripción..." : escaparHTML(valor.descripcion || "Sin descripción.")}</p>
    </div>`;
}

// Si al dato le falta algo (guardado con una versión anterior), se descarga, se guarda y se actualiza la ficha
function completarFicha(elemento, promesa, aplicar, ficha) {
  promesa
    .then((resultado) => {
      aplicar(resultado);
      guardarEquipo();
      actualizarTooltip(elemento, ficha());
    })
    .catch(() => {});
}

function contenidoFicha(elemento) {
  const poke = pokemonDe.get(elemento.closest(".tarjeta"));
  if (!poke) return "";

  if (elemento.matches(".ataque[data-indice]")) {
    const ataque = poke.ataques[Number(elemento.dataset.indice)];
    if (!ataque) return "";
    if (!ataque.categoria) {
      completarFicha(elemento, obtenerDatosCombate(ataque), (datos) => Object.assign(ataque, datos), () => fichaAtaque(ataque));
    }
    return fichaAtaque(ataque);
  }

  if (elemento.matches(".ataque.habilidad")) {
    const h = poke.habilidad;
    if (h.descripcion === undefined) {
      completarFicha(elemento, descripcionHabilidad(h.id), (texto) => (h.descripcion = texto), () => fichaTexto("Habilidad", h));
    }
    return fichaTexto("Habilidad", h);
  }

  if (elemento.matches(".ataque.objeto")) {
    const o = poke.objeto;
    const icono = imagenConRespaldo(urlsIconoObjeto(o.en), `class="ficha-icono" alt="" data-quitar-si-falla`);
    // fuente 2: descripciones de WikiDex (las guardadas antes podían estar en inglés)
    if (o.descripcion === undefined || o.fuente !== 2) {
      const aplicar = (texto) => Object.assign(o, { descripcion: texto, fuente: 2 });
      completarFicha(elemento, descripcionObjeto(o), aplicar, () => fichaTexto("Objeto", o, icono));
    }
    return fichaTexto("Objeto", o, icono);
  }

  // Foto: si es un Pokémon añadido antes de guardar las stats, se descargan ahora y se guardan
  if (!poke.stats) {
    obtenerStats(poke)
      .then((stats) => {
        poke.stats = stats;
        guardarEquipo();
        actualizarTooltip(elemento, fichaStats(poke));
      })
      .catch(() => actualizarTooltip(elemento, `<div class="ficha ficha-stats"><p>No se han podido cargar las stats.</p></div>`));
  }
  return fichaStats(poke);
}

// ---------- Arranque de la vista ----------

export function iniciarCrear() {
  campoNombre.addEventListener("input", () => {
    estado.nombre = campoNombre.value;
    guardarActual();
  });

  document.getElementById("guardar").addEventListener("click", () => {
    if (estado.equipo.length === 0) {
      mostrarAviso("Añade al menos un Pokémon antes de guardar.");
      return;
    }
    mostrarAviso(guardarEnMisEquipos() ? "Equipo guardado ✔" : "No se ha podido guardar en el navegador.");
  });

  document.getElementById("vaciar").addEventListener("click", () => {
    if (estado.equipo.length === 0) return;
    // Solo se pregunta si se perdería algo (cambios sin guardar en «Mis equipos»)
    if (hayCambiosSinGuardar()) {
      const seguro = confirm("Tienes cambios sin guardar en este equipo. ¿Vaciarlo de todas formas?");
      if (!seguro) return;
    }

    reemplazarEquipo([], "", null);
    renderCrear();
  });

  activarTooltips(resultado, ".arte, .ataque[data-indice], .ataque.habilidad, .ataque.objeto", contenidoFicha);

  const buscadorPokemon = activarAutocompletado(campoBuscar, datos.pokemon, agregarPokemon);
  document.getElementById("buscar").addEventListener("click", () => buscadorPokemon.elegirPrimera());
}
