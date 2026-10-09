// Ficha flotante que sale al pasar el ratón por encima de algo (en lugar del title del navegador).
// Hay una sola ficha para toda la web; se coloca debajo del elemento, o encima si no cabe.

const ficha = document.createElement("div");
ficha.className = "tooltip";
ficha.hidden = true;
document.body.appendChild(ficha);

let elementoActual = null;

export function mostrarTooltip(elemento, html) {
  elementoActual = elemento;
  ficha.innerHTML = html;
  ficha.hidden = false;
  colocar(elemento);
}

// Cambia el contenido sin moverla (p. ej. cuando terminan de cargar los datos)
export function actualizarTooltip(elemento, html) {
  if (elementoActual !== elemento || ficha.hidden) return;
  ficha.innerHTML = html;
  colocar(elemento);
}

export function ocultarTooltip() {
  elementoActual = null;
  ficha.hidden = true;
}

function colocar(elemento) {
  const r = elemento.getBoundingClientRect();
  const margen = 8;
  const ancho = ficha.offsetWidth;
  const alto = ficha.offsetHeight;

  let top = r.bottom + margen;
  if (top + alto > window.innerHeight - margen) top = Math.max(margen, r.top - alto - margen);

  let left = r.left + r.width / 2 - ancho / 2;
  left = Math.max(margen, Math.min(left, window.innerWidth - ancho - margen));

  ficha.style.top = `${top}px`;
  ficha.style.left = `${left}px`;
}

// Activa fichas dentro de un contenedor: para cada elemento que coincida con «selector»,
// contenido(elemento) devuelve el HTML de la ficha. Un solo oyente para todo el contenedor.
//
// retraso(elemento), opcional: milisegundos que hay que dejar el ratón encima antes de que
// salga. Así, al pasar el ratón de largo por encima de varias cosas no saltan fichas.
export function activarTooltips(contenedor, selector, contenido, retraso = () => 0) {
  let esperando = null;  // elemento cuya ficha está a punto de salir
  let temporizador = null;

  const cancelarEspera = () => {
    clearTimeout(temporizador);
    esperando = null;
  };

  const mostrar = (elemento) => {
    const html = contenido(elemento);
    if (html) mostrarTooltip(elemento, html);
  };

  contenedor.addEventListener("mouseover", (e) => {
    const elemento = e.target.closest(selector);
    if (!elemento || elemento === elementoActual || elemento === esperando) return;

    cancelarEspera();
    const espera = retraso(elemento);
    if (!espera) {
      mostrar(elemento);
      return;
    }

    // Si había otra ficha abierta, se quita ya: la nueva sale cuando toque
    if (elementoActual) ocultarTooltip();
    esperando = elemento;
    temporizador = setTimeout(() => {
      if (esperando === elemento && elemento.isConnected) mostrar(elemento);
      esperando = null;
    }, espera);
  });

  contenedor.addEventListener("mouseout", (e) => {
    // Solo cuenta salir del elemento de verdad (no pasar a uno de sus hijos)
    if (esperando && !esperando.contains(e.relatedTarget)) cancelarEspera();
    if (elementoActual && !elementoActual.contains(e.relatedTarget)) ocultarTooltip();
  });
}

// Para meter texto en el HTML de una ficha sin que se interprete como HTML
export function escaparHTML(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
