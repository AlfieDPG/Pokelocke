// Juegos de las secciones «Rutas» y «Level caps». Salen agrupados por región en la barra de arriba.
// Los datos de cada uno están en js/rutas/datos.js y js/levelcaps/datos.js (con el mismo id).

export const REGIONES = [
  { id: "kanto", nombre: "Kanto" },
  { id: "johto", nombre: "Johto" },
  { id: "hoenn", nombre: "Hoenn" },
  { id: "sinnoh", nombre: "Sinnoh" },
  { id: "teselia", nombre: "Teselia" },
  { id: "kalos", nombre: "Kalos" },
  { id: "alola", nombre: "Alola" },
  { id: "galar", nombre: "Galar" },
  { id: "paldea", nombre: "Paldea" }
];

export const JUEGOS = [
  { id: "frlg", nombre: "Rojo Fuego / Verde Hoja", region: "kanto" },
  { id: "anil", nombre: "Pokémon Añil", region: "kanto" },
  { id: "hgss", nombre: "HeartGold / SoulSilver", region: "johto" },
  { id: "oras", nombre: "Rubí Omega / Zafiro Alfa", region: "hoenn" },
  { id: "dp", nombre: "Diamante / Perla", region: "sinnoh" },
  { id: "platino", nombre: "Platino", region: "sinnoh" },
  { id: "bdsp", nombre: "Diamante Brillante / Perla Reluciente", region: "sinnoh" },
  { id: "bw", nombre: "Negro / Blanco", region: "teselia" },
  { id: "b2w2", nombre: "Negro 2 / Blanco 2", region: "teselia" },
  { id: "xy", nombre: "X / Y", region: "kalos" },
  { id: "sm", nombre: "Sol / Luna", region: "alola" },
  { id: "usum", nombre: "Ultrasol / Ultraluna", region: "alola" },
  { id: "swsh", nombre: "Espada / Escudo", region: "galar" }
];
