/* Protótipo embutido na documentação: informa a altura à página e repassa a navegação entre telas. */
(function () {
  if (window.parent === window) return;
  function enviar() {
    window.parent.postMessage({ prumo: 'altura', valor: document.documentElement.scrollHeight }, '*');
  }
  window.addEventListener('load', enviar);
  if (window.ResizeObserver) new ResizeObserver(enviar).observe(document.documentElement);
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-prumo-alvo]') : null;
    if (!a) return;
    e.preventDefault();
    window.parent.postMessage({ prumo: 'navegar', alvo: a.getAttribute('data-prumo-alvo') }, '*');
  });
})();
