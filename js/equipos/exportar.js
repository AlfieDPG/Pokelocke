// ---------- Exportar un equipo como paste de Showdown ----------
//
// La web no guarda nivel, naturaleza, EVs ni IVs, pero Showdown los pide, así que se
// rellenan siempre igual: nivel 100, naturaleza neutra, 1 EV en todo y 31 IVs en todo.

const NIVEL = 100;
const NATURALEZA = "Serious"; // neutra: no sube ni baja ninguna estadística
const EVS = "1 HP / 1 Atk / 1 Def / 1 SpA / 1 SpD / 1 Spe";
const IVS = "31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe";

// Showdown abrevia el género: "meowstic-female-mega" -> "Meowstic-F-Mega"
const ABREVIATURAS = { female: "F", male: "M" };

function trozoForma(trozo) {
  return ABREVIATURAS[trozo] || trozo.charAt(0).toUpperCase() + trozo.slice(1);
}

// "Meowstic" + "female-mega" -> "Meowstic-F-Mega"
function nombreShowdown(poke) {
  if (!poke.formaSlug) return poke.en; // guardado antes de que se apuntara la forma
  return [poke.en, ...poke.formaSlug.split("-").map(trozoForma)].join("-");
}

function bloque(poke) {
  const lineas = [];

  // Con mote, Showdown espera "Mote (Especie)"
  const nombre = poke.mote ? `${poke.mote} (${nombreShowdown(poke)})` : nombreShowdown(poke);
  lineas.push(poke.objeto ? `${nombre} @ ${poke.objeto.en}` : nombre);
  if (poke.habilidad) lineas.push(`Ability: ${poke.habilidad.en}`);
  lineas.push(`Level: ${NIVEL}`);
  if (poke.shiny) lineas.push("Shiny: Yes");
  lineas.push(`EVs: ${EVS}`);
  lineas.push(`${NATURALEZA} Nature`);
  lineas.push(`IVs: ${IVS}`);

  for (const ataque of poke.ataques) {
    if (ataque) lineas.push(`- ${ataque.en}`);
  }

  return lineas.join("\n");
}

export function pasteDelEquipo(pokemon) {
  return pokemon.map(bloque).join("\n\n");
}

// Copia al portapapeles. El método moderno solo va con https (GitHub Pages lo es);
// si no está disponible se usa el truco de la caja de texto oculta.
export async function copiarAlPortapapeles(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (error) {
    // lo intentamos de la otra forma
  }

  try {
    const caja = document.createElement("textarea");
    caja.value = texto;
    caja.setAttribute("readonly", "");
    caja.style.position = "fixed";
    caja.style.opacity = "0";
    document.body.appendChild(caja);
    caja.select();
    const copiado = document.execCommand("copy");
    caja.remove();
    return copiado;
  } catch (error) {
    return false;
  }
}
