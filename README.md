Enlace: https://alfiedpg.github.io/Pokelocke/

## Carga rápida

- `datos/nombres.json`, `datos/pokedex.json` y `img/pokedex/retratos-N.webp` van ya preparados
  para no tener que bajar y procesar los CSV de PokeAPI. Se rehacen abriendo
  `herramientas/generar-datos.html` desde la web (solo hace falta si salen Pokémon nuevos).
- `sw.js` guarda en el navegador las imágenes y datos de GitHub y PokeAPI, que si no
  caducan a los 5 minutos.
- Firestore guarda en el navegador perfiles, amistades y lockes, que salen al momento al entrar.
