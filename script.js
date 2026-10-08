const input = document.getElementById("nombre");
const boton = document.getElementById("buscar");
const resultado = document.getElementById("resultado");

const coloresTipo = {
  normal: "#a8a77a", fire: "#ee8130", water: "#6390f0", electric: "#f7d02c",
  grass: "#7ac74c", ice: "#96d9d6", fighting: "#c22e28", poison: "#a33ea1",
  ground: "#e2bf65", flying: "#a98ff3", psychic: "#f95587", bug: "#a6b91a",
  rock: "#b6a136", ghost: "#735797", dragon: "#6f35fc", dark: "#705746",
  steel: "#b7b7ce", fairy: "#d685ad"
};

const tiposEs = {
  normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico",
  grass: "Planta", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
  ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
  rock: "Roca", ghost: "Fantasma", dragon: "Dragón", dark: "Siniestro",
  steel: "Acero", fairy: "Hada"
};

const URL_ICONOS_TIPO =
  "https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/5781623f147f1bf850f426cfe1874ba56a9b75ee/icons/";

const CLAVE_DATOS = "poketeams-datos-v4";
const CLAVE_EQUIPO = "poketeams-equipo-v1";
const CLAVE_GUARDADOS = "poketeams-equipos-v1";
const CLAVE_ACTUAL = "poketeams-actual-v1";
const MAX_EQUIPO = 6;

const URL_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";

function urlSpriteHome(p) {
  return `${URL_SPRITES}pokemon/other/home/${p.idForma || p.id}.png`;
}

function urlIconoObjeto(en) {
  const slug = en
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${URL_SPRITES}items/${slug}.png`;
}

let datos = null;       // nombres de Pokémon, ataques, habilidades y objetos
let equipo = [];        // los Pokémon del equipo actual
let contadorEl = null;
let avisoEl = null;
let nombreEquipo = "";
let equipoActualId = null;

// ---------- Carga de datos (nombres en español e inglés) ----------

const URLS_BASE = [
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/",
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/main/data/v2/csv/"
];

async function descargarCSV(archivo) {
  for (const base of URLS_BASE) {
    try {
      const respuesta = await fetch(base + archivo);
      if (respuesta.ok) return await respuesta.text();
    } catch (error) {
      // probamos con la siguiente dirección
    }
  }
  throw new Error("No se pudo descargar " + archivo);
}

// Convierte el CSV en una lista de { id, es, en }
// Idioma 7 = español, idioma 9 = inglés
function leerNombres(csv) {
  const nombres = {};
  const lineas = csv.split("\n").slice(1);

  for (const linea of lineas) {
    const partes = linea.split(",");
    const id = Number(partes[0]);
    const idioma = partes[1];
    const nombre = (partes[2] || "").replace(/"/g, "").trim();

    if (!nombre || !id || id >= 10000) continue;
    if (!nombres[id]) nombres[id] = {};
    if (idioma === "7") nombres[id].es = nombre;
    if (idioma === "9") nombres[id].en = nombre;
  }

  return Object.entries(nombres)
    .filter(([id, n]) => n.en)
    .map(([id, n]) => ({ id: Number(id), en: n.en, es: n.es || n.en }));
}

// Icono estilo HOME/Switch (el mismo que se usa en Espada/Escudo y versiones posteriores)
function obtenerSpriteIcono(p) {
  const v = p.sprites.versions || {};
  const gen8 = v["generation-viii"] && v["generation-viii"].icons && v["generation-viii"].icons.front_default;
  const gen7 = v["generation-vii"] && v["generation-vii"].icons && v["generation-vii"].icons.front_default;
  return gen8 || gen7 || p.sprites.front_default;
}

function quitarAcentos(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function extraerDescripcion(m) {
  const es = (m.flavor_text_entries || []).find((e) => e.language.name === "es");
  if (es) return es.flavor_text.replace(/[\n\f\r]+/g, " ").trim();

  const en = (m.effect_entries || []).find((e) => e.language.name === "en");
  if (en) return (en.short_effect || en.effect || "").replace(/[\n\f\r]+/g, " ").trim();

  return "";
}

function prepararBusqueda(lista) {
  for (const entrada of lista) {
    entrada.buscar = quitarAcentos(entrada.es + " " + entrada.en);
  }
}

async function cargarDatos() {
  try {
    localStorage.removeItem("poketeams-datos-v1"); // versión antigua
    localStorage.removeItem("poketeams-datos-v2"); // versión antigua
    localStorage.removeItem("poketeams-datos-v3"); // versión antigua
    const guardado = localStorage.getItem(CLAVE_DATOS);
    if (guardado) {
      datos = JSON.parse(guardado);
      return;
    }
  } catch (error) {
    // si falla la lectura, descargamos de nuevo
  }

  const [csvAtaques, csvHabilidades, csvPokemon, csvObjetos] = await Promise.all([
    descargarCSV("move_names.csv"),
    descargarCSV("ability_names.csv"),
    descargarCSV("pokemon_species_names.csv"),
    descargarCSV("item_names.csv")
  ]);

  datos = {
    ataques: leerNombres(csvAtaques),
    habilidades: leerNombres(csvHabilidades),
    pokemon: leerNombres(csvPokemon),
    objetos: leerNombres(csvObjetos)
  };

  prepararBusqueda(datos.ataques);
  prepararBusqueda(datos.habilidades);
  prepararBusqueda(datos.pokemon);
  prepararBusqueda(datos.objetos);

  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
  } catch (error) {
    // si no se puede guardar, no pasa nada: se descargará la próxima vez
  }
}

// ---------- Guardado del equipo actual ----------

function cargarEquipoGuardado() {
  try {
    const guardado = localStorage.getItem(CLAVE_EQUIPO);
    return guardado ? JSON.parse(guardado) : [];
  } catch (error) {
    return [];
  }
}

function guardarEquipo() {
  try {
    localStorage.setItem(CLAVE_EQUIPO, JSON.stringify(equipo));
  } catch (error) {
    // si no se puede guardar, la web sigue funcionando
  }
}

// ---------- Desplegable de sugerencias ----------

function activarAutocompletado(campo, lista, alElegir) {
  const caja = document.createElement("div");
  caja.className = "sugerencias";
  campo.parentElement.appendChild(caja);
  let actuales = [];

  function limpiar() {
    caja.innerHTML = "";
    actuales = [];
  }

  function elegir(entrada) {
    limpiar();
    alElegir(entrada);
  }

  function mostrar() {
    limpiar();
    const texto = quitarAcentos(campo.value.trim());
    if (!texto) return;

    actuales = lista
      .filter((e) => e.buscar.includes(texto))
      .sort((a, b) => Number(b.buscar.startsWith(texto)) - Number(a.buscar.startsWith(texto)))
      .slice(0, 8);

    for (const entrada of actuales) {
      const opcion = document.createElement("div");
      opcion.className = "opcion";
      opcion.textContent = entrada.es === entrada.en ? entrada.es : `${entrada.es} (${entrada.en})`;
      opcion.addEventListener("mousedown", (e) => {
        e.preventDefault();
        elegir(entrada);
      });
      caja.appendChild(opcion);
    }
  }

  campo.addEventListener("input", mostrar);
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && actuales.length) elegir(actuales[0]);
  });
  campo.addEventListener("blur", limpiar);

  return {
    elegirPrimera: () => {
      mostrar();
      if (actuales.length) elegir(actuales[0]);
    }
  };
}

// ---------- Avisos ----------

let temporizadorAviso = null;

function mostrarAviso(texto) {
  avisoEl.textContent = texto;
  clearTimeout(temporizadorAviso);
  if (texto) {
    temporizadorAviso = setTimeout(() => {
      avisoEl.textContent = "";
    }, 3000);
  }
}

// ---------- Añadir Pokémon al equipo (búsqueda manual) ----------

async function agregarPokemon(entrada) {
  input.value = "";

  if (equipo.length >= MAX_EQUIPO) {
    mostrarAviso("El equipo ya tiene 6 Pokémon.");
    return;
  }

  mostrarAviso("Añadiendo...");

  try {
    const respuesta = await fetch(`https://pokeapi.co/api/v2/pokemon/${entrada.id}`);
    if (!respuesta.ok) throw new Error("No encontrado");

    const p = await respuesta.json();
    const imagen =
      (p.sprites.other &&
        p.sprites.other["official-artwork"] &&
        p.sprites.other["official-artwork"].front_default) ||
      p.sprites.front_default;

    equipo.push({
      id: entrada.id,
      idForma: p.id,
      es: entrada.es,
      en: entrada.en,
      imagen: imagen,
      sprite: obtenerSpriteIcono(p) || imagen,
      tipos: p.types.map((t) => t.type.name),
      habilidad: null,
      objeto: null,
      ataques: [null, null, null, null]
    });

    guardarEquipo();
    mostrarAviso("");
    render();
  } catch (error) {
    mostrarAviso("No he podido cargar ese Pokémon.");
  }
}

// Dibuja todas las tarjetas a partir de la lista "equipo"
function render() {
  resultado.innerHTML = "";
  contadorEl.textContent = `Equipo: ${equipo.length}/${MAX_EQUIPO}`;

  equipo.forEach((poke, indice) => {
    resultado.appendChild(crearTarjeta(poke, indice));
  });
}

function crearTarjeta(poke, indice) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta";

  const chipsTipos = poke.tipos
    .map(
      (t) => `
        <span class="chip" style="background:${coloresTipo[t]}">
          <span class="icono-tipo" style="--icono: url(${URL_ICONOS_TIPO}${t}.svg)"></span>
          ${tiposEs[t]}
        </span>`
    )
    .join("");

  tarjeta.innerHTML = `
    <div class="tarjeta-izq">
      <img src="${poke.imagen}" alt="${poke.es}">
      <h2>${poke.es}</h2>
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

  tarjeta.querySelector(".quitar-pokemon").addEventListener("click", () => {
    equipo.splice(indice, 1);
    guardarEquipo();
    render();
  });

  pintarCasilla(
    tarjeta.querySelector(".casilla-habilidad"),
    poke.habilidad, "Habilidad", "Habilidad", datos.habilidades, "habilidad",
    (nuevo) => {
      poke.habilidad = nuevo;
      guardarEquipo();
      render();
    }
  );

  pintarCasilla(
    tarjeta.querySelector(".casilla-objeto"),
    poke.objeto, "Objeto", "Objeto", datos.objetos, "objeto",
    (nuevo) => {
      poke.objeto = nuevo;
      guardarEquipo();
      render();
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
        ? `<img class="icono-objeto" src="${urlIconoObjeto(valor.en)}" alt="" onerror="this.remove()">`
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
        const respuesta = await fetch(`https://pokeapi.co/api/v2/move/${entrada.id}`);
        if (!respuesta.ok) throw new Error("No encontrado");

        const m = await respuesta.json();
        const ppMax = m.pp || 1;

        poke.ataques[i] = {
          id: entrada.id,
          es: entrada.es,
          en: entrada.en,
          tipo: m.type.name,
          ppMax: ppMax,
          pp: ppMax,
          descripcion: extraerDescripcion(m)
        };

        guardarEquipo();
        render();
      } catch (error) {
        campo.value = "";
        campo.placeholder = "No se pudo cargar, prueba otra vez";
      }
    });
    return;
  }

  const descripcion = (ataque.descripcion || "").replace(/"/g, "&quot;");

  hueco.innerHTML = `
    <div class="ataque" style="background:${coloresTipo[ataque.tipo]}" title="${descripcion}">
      <span class="icono-tipo" style="--icono: url(${URL_ICONOS_TIPO}${ataque.tipo}.svg)"></span>
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
    render();
  });
}

// ---------- Equipo actual (nombre e identificador) ----------

function cargarActual() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_ACTUAL));
    if (guardado) {
      nombreEquipo = guardado.nombre || "";
      equipoActualId = guardado.id || null;
    }
  } catch (error) {
    // si falla, empezamos con un equipo nuevo
  }
}

function guardarActual() {
  try {
    localStorage.setItem(
      CLAVE_ACTUAL,
      JSON.stringify({ nombre: nombreEquipo, id: equipoActualId })
    );
  } catch (error) {
    // si no se puede guardar, la web sigue funcionando
  }
}

// ---------- Equipos guardados ----------

function leerGuardados() {
  try {
    const guardado = localStorage.getItem(CLAVE_GUARDADOS);
    return guardado ? JSON.parse(guardado) : [];
  } catch (error) {
    return [];
  }
}

function escribirGuardados(lista) {
  try {
    localStorage.setItem(CLAVE_GUARDADOS, JSON.stringify(lista));
  } catch (error) {
    mostrarAviso("No se ha podido guardar en el navegador.");
  }
}

function copiaProfunda(objeto) {
  return JSON.parse(JSON.stringify(objeto));
}

function nombreParaGuardar() {
  return nombreEquipo.trim() || "Equipo sin nombre";
}

function hayCambiosSinGuardar() {
  if (equipo.length === 0) return false;
  const guardado = leerGuardados().find((g) => g.id === equipoActualId);
  if (!guardado) return true;
  return (
    JSON.stringify(guardado.pokemon) !== JSON.stringify(equipo) ||
    guardado.nombre !== nombreParaGuardar()
  );
}

function guardarEnMisEquipos() {
  if (equipo.length === 0) {
    mostrarAviso("Añade al menos un Pokémon antes de guardar.");
    return;
  }

  const guardados = leerGuardados();
  const existente = guardados.find((g) => g.id === equipoActualId);

  if (existente) {
    existente.nombre = nombreParaGuardar();
    existente.pokemon = copiaProfunda(equipo);
    existente.actualizado = Date.now();
  } else {
    equipoActualId = String(Date.now());
    guardados.push({
      id: equipoActualId,
      nombre: nombreParaGuardar(),
      pokemon: copiaProfunda(equipo),
      actualizado: Date.now()
    });
  }

  escribirGuardados(guardados);
  guardarActual();
  mostrarAviso("Equipo guardado ✔");
}

function abrirEquipo(guardado) {
  if (hayCambiosSinGuardar()) {
    const seguro = confirm(
      "Tienes cambios sin guardar en el equipo actual. ¿Abrir otro equipo y descartarlos?"
    );
    if (!seguro) return;
  }

  equipo = copiaProfunda(guardado.pokemon);
  nombreEquipo = guardado.nombre;
  equipoActualId = guardado.id;
  document.getElementById("nombre-equipo").value = nombreEquipo;

  guardarEquipo();
  guardarActual();
  mostrarVista("crear");
}

function borrarEquipo(guardado) {
  if (!confirm(`¿Borrar el equipo «${guardado.nombre}»?`)) return;

  escribirGuardados(leerGuardados().filter((g) => g.id !== guardado.id));

  if (equipoActualId === guardado.id) {
    equipoActualId = null;
    guardarActual();
  }

  renderEquipos();
}

function renderEquipos() {
  const lista = document.getElementById("lista-equipos");
  const guardados = leerGuardados().sort((a, b) => b.actualizado - a.actualizado);
  lista.innerHTML = "";

  if (guardados.length === 0) {
    lista.innerHTML =
      "<p>Todavía no has guardado ningún equipo. Crea uno y pulsa «Guardar equipo».</p>";
    return;
  }

  for (const guardado of guardados) {
    const fecha = new Date(guardado.actualizado).toLocaleDateString("es-ES");
    const miniaturas = guardado.pokemon
      .map((p) => {
        const respaldo = p.sprite || p.imagen || "";
        return `<img src="${urlSpriteHome(p)}" alt="${p.es}" title="${p.es}" onerror="this.onerror=null;this.src='${respaldo}'">`;
      })
      .join("");

    const tarjeta = document.createElement("div");
    tarjeta.className = "equipo-guardado";
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

// ---------- Pestañas ----------

function mostrarVista(vista) {
  const crear = vista === "crear";

  document.getElementById("vista-crear").hidden = !crear;
  document.getElementById("vista-equipos").hidden = crear;
  document.getElementById("tab-crear").classList.toggle("activa", crear);
  document.getElementById("tab-equipos").classList.toggle("activa", !crear);

  if (crear) {
    render();
  } else {
    renderEquipos();
  }
}

// ---------- Importar paste de Showdown ----------

const cacheAPI = new Map();

async function pedirJSON(url) {
  if (cacheAPI.has(url)) return cacheAPI.get(url);
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error("Error " + respuesta.status);
  const json = await respuesta.json();
  cacheAPI.set(url, json);
  return json;
}

// "Heavy-Duty Boots" -> "heavydutyboots": para comparar nombres sin fijarse en símbolos
function normalizarNombre(texto) {
  return quitarAcentos(texto).replace(/[^a-z0-9]/g, "");
}

function buscarPorNombreIngles(lista, nombre) {
  const clave = normalizarNombre(nombre);
  return lista.find((e) => normalizarNombre(e.en) === clave) || null;
}

// Primera línea del paste: "Apodo (Especie) (F) @ Objeto"
function leerPrimeraLinea(linea) {
  let texto = linea.trim();
  let objeto = null;

  const trozos = texto.split(" @ ");
  texto = trozos[0].trim();
  if (trozos.length > 1) objeto = trozos.slice(1).join(" @ ").trim();

  texto = texto.replace(/\s*\((M|F)\)\s*$/, "");

  const apodo = texto.match(/^.*\s\(([^()]+)\)$/);
  const especie = apodo ? apodo[1] : texto;

  return { especie: especie.trim(), objeto: objeto };
}

function interpretarPaste(texto) {
  let nombre = "";

  // Formato de copia de seguridad: === [gen9ou] Carpeta/Nombre ===
  const cabecera = texto.match(/^===\s*(?:\[[^\]]*\]\s*)?(.*?)\s*===\s*$/m);
  if (cabecera) {
    nombre = cabecera[1].split("/").pop().trim();
    texto = texto.replace(cabecera[0], "");
  }

  const bloques = texto
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const pokemon = [];

  for (const bloque of bloques) {
    const lineas = bloque.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lineas.length === 0) continue;

    const primera = leerPrimeraLinea(lineas[0]);
    let habilidad = null;
    const ataques = [];

    for (const linea of lineas.slice(1)) {
      if (/^Ability:/i.test(linea)) {
        habilidad = linea.replace(/^Ability:/i, "").trim();
      } else if (linea.startsWith("-")) {
        ataques.push(linea.replace(/^-\s*/, "").trim());
      }
    }

    pokemon.push({
      especie: primera.especie,
      objeto: primera.objeto,
      habilidad: habilidad,
      ataques: ataques.slice(0, 4)
    });
  }

  return { nombre: nombre, pokemon: pokemon };
}

function pokemonDesdeAPI(p, entrada) {
  const imagen =
    (p.sprites.other &&
      p.sprites.other["official-artwork"] &&
      p.sprites.other["official-artwork"].front_default) ||
    p.sprites.front_default ||
    "";

  return {
    id: entrada.id,
    idForma: p.id,
    es: entrada.es,
    en: entrada.en,
    imagen: imagen,
    sprite: obtenerSpriteIcono(p) || imagen,
    tipos: p.types.map((t) => t.type.name),
    habilidad: null,
    objeto: null,
    ataques: [null, null, null, null]
  };
}

// Busca el Pokémon por su nombre de Showdown (con formas: Landorus-Therian...)
async function resolverPokemon(nombre) {
  try {
    // 1) Especie normal: Pikachu, Ho-Oh, Mr. Mime...
    const especie = buscarPorNombreIngles(datos.pokemon, nombre);
    if (especie) {
      const p = await pedirJSON(`https://pokeapi.co/api/v2/pokemon/${especie.id}`);
      return pokemonDesdeAPI(p, especie);
    }

    // 2) Forma especial: Landorus-Therian, Charizard-Mega-X...
    const slug = quitarAcentos(nombre)
      .replace(/[.'’:%]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    try {
      const p = await pedirJSON(`https://pokeapi.co/api/v2/pokemon/${slug}`);
      const idEspecie = Number(p.species.url.split("/").filter(Boolean).pop());
      const entrada = datos.pokemon.find((e) => e.id === idEspecie);
      if (entrada) return pokemonDesdeAPI(p, entrada);
    } catch (error) {
      // no es una forma conocida: probamos quitando el final
    }
  } catch (error) {
    return null;
  }

  // 3) Quitamos la última parte tras el guion y reintentamos (usa la especie base)
  const partes = nombre.split("-");
  if (partes.length > 1) {
    return resolverPokemon(partes.slice(0, -1).join("-"));
  }
  return null;
}

async function resolverAtaque(nombre) {
  let entrada = buscarPorNombreIngles(datos.ataques, nombre);

  // "Hidden Power Fire" -> "Hidden Power"
  if (!entrada && nombre.includes(" ")) {
    entrada = buscarPorNombreIngles(datos.ataques, nombre.split(" ").slice(0, -1).join(" "));
  }
  if (!entrada) return null;

  const m = await pedirJSON(`https://pokeapi.co/api/v2/move/${entrada.id}`);
  const ppMax = m.pp || 1;

  return {
    id: entrada.id,
    es: entrada.es,
    en: entrada.en,
    tipo: m.type.name,
    ppMax: ppMax,
    pp: ppMax,
    descripcion: extraerDescripcion(m)
  };
}

// Devuelve true si se ha importado, false si no
async function importarPaste(texto) {
  const interpretado = interpretarPaste(texto);

  if (interpretado.pokemon.length === 0) {
    alert("No he encontrado ningún Pokémon en ese texto. Revisa que sea un paste de Showdown.");
    return false;
  }

  if (hayCambiosSinGuardar()) {
    const seguro = confirm(
      "Tienes cambios sin guardar en el equipo actual. ¿Reemplazarlo con el equipo importado?"
    );
    if (!seguro) return false;
  }

  const problemas = [];
  const lista = interpretado.pokemon.slice(0, MAX_EQUIPO);

  const nuevos = await Promise.all(
    lista.map(async (p) => {
      const resuelto = await resolverPokemon(p.especie);
      if (!resuelto) {
        problemas.push(`Pokémon no reconocido: ${p.especie}`);
        return null;
      }

      if (p.habilidad) {
        const h = buscarPorNombreIngles(datos.habilidades, p.habilidad);
        if (h) {
          resuelto.habilidad = { id: h.id, es: h.es, en: h.en };
        } else {
          problemas.push(`Habilidad no encontrada: ${p.habilidad} (${resuelto.es})`);
        }
      }

      if (p.objeto) {
        const o = buscarPorNombreIngles(datos.objetos, p.objeto);
        if (o) {
          resuelto.objeto = { id: o.id, es: o.es, en: o.en };
        } else {
          problemas.push(`Objeto no encontrado: ${p.objeto} (${resuelto.es})`);
        }
      }

      const ataques = await Promise.all(
        p.ataques.map(async (nombreAtaque) => {
          try {
            return await resolverAtaque(nombreAtaque);
          } catch (error) {
            return null;
          }
        })
      );

      ataques.forEach((ataque, i) => {
        if (ataque) {
          resuelto.ataques[i] = ataque;
        } else {
          problemas.push(`Ataque no encontrado: ${p.ataques[i]} (${resuelto.es})`);
        }
      });

      return resuelto;
    })
  );

  const validos = nuevos.filter(Boolean);
  if (validos.length === 0) {
    alert("No he podido reconocer ningún Pokémon de ese texto:\n\n• " + problemas.join("\n• "));
    return false;
  }

  if (interpretado.pokemon.length > MAX_EQUIPO) {
    problemas.push(
      `El paste tenía más de ${MAX_EQUIPO} Pokémon: solo se han importado los primeros ${MAX_EQUIPO}.`
    );
  }

  equipo = validos;
  nombreEquipo = interpretado.nombre;
  equipoActualId = null;
  document.getElementById("nombre-equipo").value = nombreEquipo;

  guardarEquipo();
  guardarActual();
  mostrarVista("crear");

  if (problemas.length > 0) {
    alert("Equipo importado, pero algunas cosas no se han podido reconocer:\n\n• " + problemas.join("\n• "));
  } else {
    mostrarAviso("Equipo importado ✔");
  }

  return true;
}

function activarImportacion() {
  const dialogo = document.getElementById("dialogo-importar");
  const texto = document.getElementById("texto-paste");
  const aceptar = document.getElementById("importar-aceptar");

  document.getElementById("boton-importar").addEventListener("click", () => {
    texto.value = "";
    dialogo.showModal();
    texto.focus();
  });

  document.getElementById("importar-cancelar").addEventListener("click", () => {
    dialogo.close();
  });

  aceptar.addEventListener("click", async () => {
    if (!texto.value.trim()) return;

    aceptar.disabled = true;
    aceptar.textContent = "Importando...";
    const terminado = await importarPaste(texto.value);
    aceptar.disabled = false;
    aceptar.textContent = "Importar";

    if (terminado) dialogo.close();
  });
}

// ---------- Arranque ----------

resultado.innerHTML = "<p>Cargando datos de Pokémon (solo tarda la primera vez)...</p>";

contadorEl = document.getElementById("contador");
avisoEl = document.getElementById("aviso");

cargarDatos()
  .then(() => {
    const campoNombre = document.getElementById("nombre-equipo");

    cargarActual();
    campoNombre.value = nombreEquipo;
    campoNombre.addEventListener("input", () => {
      nombreEquipo = campoNombre.value;
      guardarActual();
    });

    document.getElementById("guardar").addEventListener("click", guardarEnMisEquipos);
    activarImportacion();

    document.getElementById("vaciar").addEventListener("click", () => {
      if (equipo.length === 0) return;
      const seguro = confirm(
        "¿Seguro que quieres vaciar el equipo? Si lo habías guardado, seguirá en «Mis equipos»."
      );
      if (!seguro) return;

      equipo = [];
      nombreEquipo = "";
      equipoActualId = null;
      campoNombre.value = "";
      guardarEquipo();
      guardarActual();
      render();
    });

    document.getElementById("tab-crear").addEventListener("click", () => mostrarVista("crear"));
    document.getElementById("tab-equipos").addEventListener("click", () => mostrarVista("equipos"));

    const buscadorPokemon = activarAutocompletado(input, datos.pokemon, agregarPokemon);
    boton.addEventListener("click", () => buscadorPokemon.elegirPrimera());

    equipo = cargarEquipoGuardado();
    render();
  })
  .catch(() => {
    resultado.innerHTML = "<p>No he podido cargar los datos. Revisa tu conexión y recarga la página.</p>";
  });