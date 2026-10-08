// Sección «Equipos»: vistas «crear» (Crear equipo) y «equipos» (Mis equipos)

import { cargarDatos } from "../comun/datos.js";
import { cargarEstado } from "./estado.js";
import { iniciarCrear, renderCrear, mostrarMensaje } from "./crear.js";
import { renderMisEquipos } from "./mis-equipos.js";
import { iniciarImportar } from "./importar.js";

export async function iniciar() {
  mostrarMensaje("Cargando datos de Pokémon (solo tarda la primera vez)...");

  try {
    await cargarDatos();
  } catch (error) {
    mostrarMensaje("No he podido cargar los datos. Revisa tu conexión y recarga la página.");
    throw error;
  }

  cargarEstado();
  iniciarCrear();
  iniciarImportar();
}

export function mostrar(vista) {
  if (vista === "crear") {
    renderCrear();
  } else {
    renderMisEquipos();
  }
}
