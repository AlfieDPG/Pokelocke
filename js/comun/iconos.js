// ---------- Iconos ----------
//
// SVG metido directamente en la página, con el mismo trazo que los iconos de Lucide
// (licencia MIT). No se usa ninguna librería externa: son cuatro líneas de dibujo y así
// no hay que descargar una fuente de iconos entera ni depender de otra web.
//
// Heredan el color del botón (currentColor) y se escalan con el tamaño de letra.

const DIBUJOS = {
  copiar: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
           <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
  papelera: `<path d="M3 6h18"/>
             <path d="M19 6v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V6"/>
             <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2"/>
             <path d="M10 11v6"/>
             <path d="M14 11v6"/>`,
  guardar: `<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
            <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>
            <path d="M7 3v4a1 1 0 0 0 1 1h7"/>`,
  visto: `<path d="M20 6 9 17l-5-5"/>`,
  aspa: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`
};

export function icono(nombre) {
  return `<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${DIBUJOS[nombre] || ""}</svg>`;
}
