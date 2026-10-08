import { pedirJSON, URL_API } from "./api.js";

// ---------- Formas (Alola, Galar, Héroe...) ----------

// Variedades de PokeAPI que no interesan: gorras de Pikachu, Gigamax, tótems, formas que solo
// existen en combate (Wishiwashi banco, Mimikyu descubierto...), colores de Minior, modos de Koraidon/Miraidon...
const FORMAS_OCULTAS = new RegExp(
  "-(cap|cosplay|rock-star|belle|pop-star|phd|libre|starter|totem|gmax|eternamax|spiky-eared|power-construct|" +
    "stellar|terastal|battle-bond|own-tempo|school|busted|gulping|gorging|noice|hangry|complete|blade)|" +
    "^(minior|koraidon|miraidon)-"
);

export function formaVisible(slug) {
  return !FORMAS_OCULTAS.test(slug);
}

// Nombres para una variedad concreta (cuando el sufijo solo no basta)
const NOMBRES_VARIEDAD = {
  "necrozma-dusk": "Melena Crepuscular", "necrozma-dawn": "Alas del Alba",
  "calyrex-ice": "Jinete Glacial", "calyrex-shadow": "Jinete Espectral"
};

const NOMBRES_FORMA = {
  "pom-pom": "Animado", "pau": "Plácido", "sensu": "Refinado", "eternal": "Eterna", "dada": "Papá",
  "paldea-combat-breed": "Paldea (Raza Combatiente)", "paldea-blaze-breed": "Paldea (Raza Ardiente)",
  "paldea-aqua-breed": "Paldea (Raza Acuática)", "family-of-three": "Familia de Tres",
  "curly": "Curvada", "droopy": "Lánguida", "stretchy": "Recta", "roaming": "Andante",
  "blue-plumage": "Plumaje Azul", "yellow-plumage": "Plumaje Amarillo", "white-plumage": "Plumaje Blanco",
  "wellspring-mask": "Máscara Fuente", "hearthflame-mask": "Máscara Horno", "cornerstone-mask": "Máscara Cimiento",
  "alola": "Alola", "galar": "Galar", "hisui": "Hisui", "paldea": "Paldea",
  "mega": "Mega", "mega-x": "Mega X", "mega-y": "Mega Y", "primal": "Primigenia",
  "standard": "Normal", "zero": "Normal", "ordinary": "Normal", "average": "Normal",
  "incarnate": "Avatar", "therian": "Tótem", "altered": "Modificada", "origin": "Origen",
  "zen": "Daruma", "hero": "Héroe", "sky": "Cielo", "land": "Tierra",
  "attack": "Ataque", "defense": "Defensa", "speed": "Velocidad",
  "plant": "Planta", "sandy": "Arena", "trash": "Basura",
  "heat": "Calor", "wash": "Lavado", "frost": "Frío", "fan": "Ventilador", "mow": "Corte",
  "male": "Macho", "female": "Hembra", "busted": "Descubierta", "disguised": "Encubierta",
  "low-key": "Grave", "amped": "Aguda", "midday": "Diurna", "midnight": "Nocturna",
  "dusk": "Crepuscular", "solo": "Individual", "school": "Banco",
  "small": "Pequeño", "large": "Grande", "super": "Enorme", "complete": "Completa",
  "10": "10%", "50": "50%", "unbound": "Desatado", "confined": "Contenido",
  "single-strike": "Puño Directo", "rapid-strike": "Puño Fluido",
  "ice": "Hielo", "shadow": "Sombra", "dawn-wings": "Alas del Alba",
  "dusk-mane": "Melena Crepuscular", "ultra": "Ultra", "hangry": "Voraz",
  "full-belly": "Saciada", "noice": "Cara Deshielo", "crowned": "Coronado",
  "rainy": "Lluvia", "snowy": "Nieve", "sunny": "Sol", "blade": "Filo", "shield": "Escudo",
  "resolute": "Brío", "aria": "Lírica", "pirouette": "Pirueta",
  "red-striped": "Raya Roja", "blue-striped": "Raya Azul", "white-striped": "Raya Blanca",
  "bloodmoon": "Luna Carmesí", "hearthflame": "Horno", "wellspring": "Fuente",
  "cornerstone": "Cimiento", "teal": "Turquesa"
};

// "persian-alola" + "persian" -> "Alola"
export function etiquetaForma(slug, especie) {
  const sufijo = especie && slug.startsWith(especie + "-") ? slug.slice(especie.length + 1) : "";
  if (!sufijo) return "Normal";
  if (NOMBRES_VARIEDAD[slug]) return NOMBRES_VARIEDAD[slug];
  if (NOMBRES_FORMA[sufijo]) return NOMBRES_FORMA[sufijo];

  let tokens = sufijo.split("-").map((t) => NOMBRES_FORMA[t] || t.charAt(0).toUpperCase() + t.slice(1));
  if (tokens.length > 1) tokens = tokens.filter((t) => t !== "Normal");
  return tokens.join(" ");
}

// Formas elegibles de una especie. La primera es la normal.
// La posición en la lista se usa también para buscar el retrato de Mundo Misterioso.
export async function obtenerVariedades(idEspecie) {
  const sp = await pedirJSON(`${URL_API}pokemon-species/${idEspecie}`);
  const porDefecto = (sp.varieties.find((v) => v.is_default) || sp.varieties[0]).pokemon.name;
  const otras = sp.varieties
    .map((v) => v.pokemon.name)
    .filter((n) => n !== porDefecto && !FORMAS_OCULTAS.test(n));
  return { especie: sp.name, lista: [porDefecto, ...otras] };
}
