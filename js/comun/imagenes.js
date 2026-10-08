// ---------- Imágenes (arte, HOME, Mundo Misterioso, objetos) ----------

const URL_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";
const URL_PMD = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/";

function idImagen(p) {
  return p.idForma || p.id;
}

// Arte grande (normal o shiny)
export function urlArte(p) {
  if (!p.shiny) return p.imagen;
  return `${URL_SPRITES}pokemon/other/official-artwork/shiny/${idImagen(p)}.png`;
}

// Render HOME (normal o shiny)
export function urlSpriteHome(p) {
  return `${URL_SPRITES}pokemon/other/home/${p.shiny ? "shiny/" : ""}${idImagen(p)}.png`;
}

// Arte grande con sus respaldos, por orden de preferencia
export function urlsArte(p) {
  return [urlArte(p), p.imagen, urlSpriteHome(p)];
}

// Sprite pixelado pequeño (96x96). Sirve también para las formas alternativas,
// que tienen su propio id (Mega-Charizard X es el 10034).
export function urlSpritePixel(id) {
  return `${URL_SPRITES}pokemon/${id}.png`;
}

function cuatroCifras(n) {
  return String(n).padStart(4, "0");
}

// Retratos de Pokémon Mundo Misterioso (PMD SpriteCollab), de más a menos concreto
export function urlsPMD(p) {
  const dex = cuatroCifras(p.id);
  const forma = p.formaPMD || 0;
  const lista = [];
  if (p.shiny) lista.push(`${URL_PMD}${dex}/${cuatroCifras(forma)}/0001/Normal.png`);
  if (forma) lista.push(`${URL_PMD}${dex}/${cuatroCifras(forma)}/Normal.png`);
  lista.push(`${URL_PMD}${dex}/Normal.png`);
  return lista;
}

// Iconos de objetos, de mejor a peor:
//   1) Icono HD de Escarlata/Púrpura (Serebii): "Heavy-Duty Boots" -> heavy-dutyboots.png,
//      "King's Rock" -> king'srock.png (minúsculas, sin espacios ni acentos; guiones y apóstrofos se quedan)
//   2) Icono HD de Leyendas Z-A (Serebii), con el mismo nombre de archivo: objetos que no
//      salen en Escarlata/Púrpura, sobre todo las megapiedras nuevas ("Chandelurite" -> chandelurite.png)
//   3) Icono pixelado de PokeAPI (lo que no esté en ninguno de los dos)
const URL_OBJETOS_SV = "https://www.serebii.net/itemdex/sprites/sv/";
const URL_OBJETOS_ZA = "https://www.serebii.net/itemdex/sprites/za/";

export function urlsIconoObjeto(en) {
  const sinAcentos = en.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/’/g, "'");
  const serebii = sinAcentos.replace(/\s+/g, "");
  const pokeapi = sinAcentos
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return [
    `${URL_OBJETOS_SV}${serebii}.png`,
    `${URL_OBJETOS_ZA}${serebii}.png`,
    `${URL_SPRITES}items/${pokeapi}.png`
  ];
}

// ---------- <img> con direcciones de respaldo ----------

// <img> que prueba varias direcciones seguidas hasta que una cargue
export function imagenConRespaldo(urls, atributos) {
  const [primera, ...resto] = urls.filter(Boolean);
  return `<img src="${primera}" data-respaldo="${resto.join("|")}" ${atributos || ""}>`;
}

// Los errores de carga de imágenes no "suben" por la página, pero se pueden escuchar
// en fase de captura: así un solo oyente sirve para todas las <img data-respaldo>.
// Si se acaban las direcciones y la imagen tiene data-quitar-si-falla, se elimina.
export function activarRespaldoImagenes() {
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-respaldo")) return;

      const resto = img.dataset.respaldo.split("|").filter(Boolean);
      if (resto.length === 0) {
        img.removeAttribute("data-respaldo");
        if (img.hasAttribute("data-quitar-si-falla")) img.remove();
        return;
      }
      img.src = resto.shift();
      img.dataset.respaldo = resto.join("|");
    },
    true
  );
}

// ---------- Precarga ----------

const precargadas = new Map(); // url -> promesa: true si cargó, false si falló

export function precargarImagen(url) {
  if (!precargadas.has(url)) {
    precargadas.set(
      url,
      new Promise((resolver) => {
        const img = new Image();
        img.onload = () => resolver(true);
        img.onerror = () => resolver(false);
        img.src = url;
      })
    );
  }
  return precargadas.get(url);
}

// Descarga las imágenes cuando el navegador no tiene nada mejor que hacer
export function precargarEnReposo(urls) {
  const enReposo = window.requestIdleCallback || ((tarea) => setTimeout(tarea, 200));
  enReposo(() => urls.filter(Boolean).forEach(precargarImagen));
}

const ultimoCambio = new WeakMap(); // img -> último cambio pedido

// Cambia la imagen sin que desaparezca: la nueva se descarga aparte
// y solo se pone cuando ya está lista. Prueba las direcciones por orden.
export async function cambiarImagen(img, urls) {
  const pedido = urls.join("|");
  ultimoCambio.set(img, pedido);

  for (const url of urls.filter(Boolean)) {
    const cargada = await precargarImagen(url);
    if (ultimoCambio.get(img) !== pedido) return; // mientras tanto se pidió otro cambio
    if (cargada) {
      img.removeAttribute("data-respaldo");
      img.src = url;
      return;
    }
  }
}
