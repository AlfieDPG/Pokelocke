// ---------- Número de retrato de cada forma en Mundo Misterioso ----------
//
// Los retratos van en subcarpetas numeradas por la posición de la forma entre las
// variedades de su especie (la normal es la 0). Mundo Misterioso casi siempre numera
// igual que PokeAPI, pero no siempre: aquí están las que no coinciden, comprobadas una
// a una contra su tracker.json. Las que valen 0 es que no tienen retrato propio y se
// acaba usando el de la especie.

const CORRECCIONES = {
  10071: 2, // Slowbro Mega (Mundo Misterioso pone la de Galar delante)
  10165: 1, // Slowbro de Galar
  10117: 1, // Greninja Ash
  10294: 2, // Greninja Mega
  10061: 5, // Floette Eterna
  10296: 6, // Floette Mega
  10181: 1, // Zygarde 10%
  10120: 2, // Zygarde Completa
  10136: 1, // Minior Núcleo
  10312: 2, // Darkrai Mega
  10314: 1, // Meowstic Mega (macho)
  10326: 1, // Meowstic Mega (hembra): comparten el mismo retrato «Mega»
  10253: 2, // Wooper de Paldea (la 1 es un Wooper «Beta»)
  10273: 5, // Ogerpon Máscara Fuente: el retrato con la máscara puesta (las 1-3 son
  10274: 6, // Ogerpon Máscara Horno     la cara sin máscara, con la capucha de otro color)
  10275: 7, // Ogerpon Máscara Cimiento
  10248: 0, // Basculegion hembra: Mundo Misterioso no tiene retrato suyo
  10254: 0, // Oinkologne hembra: tampoco
  10158: 0, // Pikachu Compañero: tampoco
  10159: 0  // Eevee Compañero: tampoco
};

// idForma: el id de PokeAPI de esa forma (10314 = Mega-Meowstic macho).
// posicion: la que le tocaría por orden de variedades.
export function indicePMD(idForma, posicion) {
  const correccion = CORRECCIONES[idForma];
  return correccion !== undefined ? correccion : posicion || 0;
}
