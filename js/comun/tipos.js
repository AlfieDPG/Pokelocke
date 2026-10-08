export const coloresTipo = {
  normal: "#a8a77a", fire: "#ee8130", water: "#6390f0", electric: "#f7d02c",
  grass: "#7ac74c", ice: "#96d9d6", fighting: "#c22e28", poison: "#a33ea1",
  ground: "#e2bf65", flying: "#a98ff3", psychic: "#f95587", bug: "#a6b91a",
  rock: "#b6a136", ghost: "#735797", dragon: "#6f35fc", dark: "#705746",
  steel: "#b7b7ce", fairy: "#d685ad"
};

export const tiposEs = {
  normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico",
  grass: "Planta", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
  ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
  rock: "Roca", ghost: "Fantasma", dragon: "Dragón", dark: "Siniestro",
  steel: "Acero", fairy: "Hada"
};

const URL_ICONOS_TIPO =
  "https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/5781623f147f1bf850f426cfe1874ba56a9b75ee/icons/";

export function iconoTipo(tipo) {
  return `<span class="icono-tipo" style="--icono: url(${URL_ICONOS_TIPO}${tipo}.svg)"></span>`;
}
