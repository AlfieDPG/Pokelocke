// ---------- Lockes ganados de antes de que hubiera cuentas ----------
//
// Esta era la sección «Jugadores»: una lista fija, igual para todo el mundo. Ya no se
// enseña a nadie; lo único que queda es el atajo del diálogo «Mis lockes ganados», que te trae
// de una vez tus lockes viejos en vez de escribirlos a mano uno por uno.
//
// Cuando Alfie y Pedro los hayan traído, este archivo se puede borrar.

// Los tipos que usábamos nosotros. Ya no vienen de serie en las cuentas nuevas, así que el
// atajo los trae junto con los lockes. Mismos id que tenían antes, para que se sumen bien
// en el recuento de quien ya los tuviera.
export const TIPOS_LEGADO = [
  { id: "locke", nombre: "Locke", color: "#3498db" },
  { id: "mega", nombre: "Megalocke", color: "#f1c40f" },
  { id: "bebe", nombre: "Bebelocke", color: "#e84393" }
];

export const LEGADO = [
  {
    clave: "alfie",
    nombre: "Alfie",
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
    clave: "pedro",
    nombre: "Pedro",
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
  { clave: "marc", nombre: "Marc", lockes: [] },
  { clave: "nico", nombre: "Nico", lockes: [] },
  { clave: "diego", nombre: "Diego", lockes: [] },
  { clave: "varo", nombre: "Varo", lockes: [] }
];
