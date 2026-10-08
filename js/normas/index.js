// Sección «Normas»: reglas del Nuzlocke, agrupadas por apartados.
// Para añadir o cambiar una norma basta con editar APARTADOS. La clase de cada apartado
// (basicas, clausulas, dificultad, final) es la que le da su color en css/nuzlocke.css.

const APARTADOS = [
  {
    clase: "basicas",
    titulo: "Reglas básicas",
    normas: [
      ["Una captura por zona", "Solo puedes intentar capturar el primer Pokémon salvaje que encuentres en cada ruta, ciudad o zona. Si se debilita o huye, pierdes la captura de esa zona."],
      ["Debilitado = muerto", "Si un Pokémon se debilita, se considera muerto: no puedes volver a usarlo. Libéralo o déjalo para siempre en una caja «cementerio»."],
      ["Motes obligatorios", "Pon mote a todos tus Pokémon."]
    ]
  },
  {
    clase: "clausulas",
    titulo: "Cláusulas",
    normas: [
      ["Cláusula de duplicados", "Si el primer Pokémon de una zona es de una especie que ya tienes, puedes pasar al siguiente Pokémon o capturarlo igualmente. Si lo capturas, no podrás usar esa segunda versión hasta que se te muera la primera."],
      ["Cláusula variocolor", "Los Pokémon variocolor se pueden capturar siempre, aunque no sean el primero de la zona."],
      ["Cláusula de objetos", "No se puede repetir objeto en el equipo: dos Pokémon no pueden llevar el mismo objeto equipado."],
      ["Pokémon que no cuentan como Pokémon de ruta", "Ditto, Smeargle, Shedinja y Unown no cuentan como el Pokémon de la ruta: si te sale uno, no gastas la captura de esa zona."]
    ]
  },
  {
    clase: "dificultad",
    titulo: "Restricciones de dificultad",
    normas: [
      ["Level cap", "Tus Pokémon no pueden superar el nivel del Pokémon más alto del siguiente combate importante (mira la sección «Level caps»)."],
      ["Estilo de combate fijo", "Juega con el estilo de combate «Fijo»: no puedes cambiar de Pokémon gratis cuando debilitas al del rival."],
      ["Habilidades limitadas (Randomlocke)", "No puedes llevar en el equipo más de un Pokémon con las habilidades Amor Filial, Potencia o Energía Pura."],
      ["Compras en tiendas especiales", "En las tiendas especiales solo puedes comprar una unidad de cada objeto, y nunca objetos que curen PS. Las bayas sí están permitidas: son lo único que puede curarte que se puede comprar."]
    ]
  },
  {
    clase: "final",
    titulo: "Fin de la partida",
    normas: [
      ["Fin de la partida", "Has perdido el Nuzlocke si se debilitan todos los Pokémon de tu equipo y no te quedan Pokémon en el PC, o si se te han acabado las vidas."]
    ]
  }
];

function plantillaApartado({ clase, titulo, normas }) {
  return `
    <section class="normas-grupo ${clase}">
      <h2>${titulo}</h2>
      <ul>
        ${normas.map(([nombre, texto]) => `<li><strong>${nombre}</strong><p>${texto}</p></li>`).join("")}
      </ul>
    </section>`;
}

export function iniciar() {
  document.querySelector("#vista-normas .normas").innerHTML = APARTADOS.map(plantillaApartado).join("");
}

export function mostrar() {
  // contenido fijo: no hay nada que actualizar
}
