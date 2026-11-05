/*
 * Protótipo do Prumo (comum aos kits): navegação, "Simular erro", "Voltar" e aviso de ação sem destino (RN-84, RN-85).
 * - Aberto com #captura (captura de PNG): não faz nada, para o PNG sair igual.
 * - Dentro de um iframe (documentação, programa): informa a altura, repassa a navegação marcada com data-prumo-alvo e
 *   recebe "simular" e "voltar" do hospedeiro; a barra fica com o hospedeiro.
 * - Aberto direto (pasta, navegador): mostra a barra do protótipo.
 */
(function () {
  if (/captura/.test(location.hash)) return;
  var dentro = window.parent !== window;
  var CHAVE_SIMULAR = 'prumo:simular';
  var CHAVE_PERCURSO = 'prumo:percurso';
  var CHAVE_NAVEGANDO = 'prumo:navegando';

  function ler(chave, padrao) {
    try {
      var v = sessionStorage.getItem(chave);
      return v === null ? padrao : JSON.parse(v);
    } catch (e) {
      return padrao;
    }
  }
  function gravar(chave, v) {
    try {
      sessionStorage.setItem(chave, JSON.stringify(v));
    } catch (e) {
      /* sem sessionStorage: o protótipo funciona sem lembrar o percurso */
    }
  }

  // Percurso (RN-85): abrir uma página sem ter vindo de um clique no protótipo começa um percurso novo.
  var percurso = ler(CHAVE_PERCURSO, []);
  if (!ler(CHAVE_NAVEGANDO, false)) percurso = [];
  gravar(CHAVE_NAVEGANDO, false);
  gravar(CHAVE_PERCURSO, percurso);

  function ir(href) {
    percurso.push(location.href);
    gravar(CHAVE_PERCURSO, percurso);
    gravar(CHAVE_NAVEGANDO, true);
    location.href = href;
  }
  function voltar() {
    var anterior = percurso.pop();
    if (!anterior) return;
    gravar(CHAVE_PERCURSO, percurso);
    gravar(CHAVE_NAVEGANDO, true);
    location.href = anterior;
  }

  var status;
  function anunciar(texto) {
    if (dentro) {
      window.parent.postMessage({ prumo: 'aviso', texto: texto }, '*');
      return;
    }
    if (status) status.textContent = texto;
  }

  // Próximo estado de erro de uma ação (RN-84): percorre os erros em ordem a cada clique.
  function proximoErro(el, atributo) {
    var lista = (el.getAttribute(atributo) || '').split(' ').filter(Boolean);
    if (!lista.length) return null;
    var chave = 'prumo:erro:' + (el.getAttribute('data-testid') || el.textContent);
    var i = ler(chave, 0) % lista.length;
    gravar(chave, i + 1);
    return lista[i];
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a, button') : null;
    if (!el) return;
    var simular = ler(CHAVE_SIMULAR, false);
    // Arquivo único da documentação: os destinos viram "alvos" (módulo/tela/estado) que o hospedeiro abre.
    var erroAlvo = simular && dentro ? proximoErro(el, 'data-prumo-erros-alvo') : null;
    var erro = simular && !erroAlvo ? proximoErro(el, 'data-prumo-erros') : null;
    if (dentro) {
      var alvo = erroAlvo || (erro ? null : el.getAttribute('data-prumo-alvo'));
      if (erro) {
        e.preventDefault();
        location.href = erro;
        return;
      }
      if (alvo) {
        e.preventDefault();
        window.parent.postMessage({ prumo: 'navegar', alvo: alvo }, '*');
        return;
      }
    } else if (erro) {
      e.preventDefault();
      ir(erro);
      return;
    }
    if (el.hasAttribute('data-prumo-sem-destino')) {
      e.preventDefault();
      anunciar('Esta ação não está descrita nos cenários.');
      return;
    }
    var href = el.getAttribute('href');
    if (!dentro && href && href !== '#' && el.tagName === 'A' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      ir(href);
    }
  });

  if (dentro) {
    var enviar = function () {
      window.parent.postMessage({ prumo: 'altura', valor: document.documentElement.scrollHeight }, '*');
    };
    window.addEventListener('load', enviar);
    if (window.ResizeObserver) new ResizeObserver(enviar).observe(document.documentElement);
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || e.source !== window.parent) return;
      if (d.prumo === 'simular') gravar(CHAVE_SIMULAR, !!d.valor);
      if (d.prumo === 'voltar') voltar();
    });
    return;
  }

  // Barra do protótipo (aberto direto): estado, Simular erro, Voltar e o aviso.
  function montarBarra() {
    var corpo = document.body;
    var barra = document.createElement('div');
    barra.className = 'prumo-barra';
    barra.setAttribute('role', 'toolbar');
    barra.setAttribute('aria-label', 'Protótipo');
    barra.setAttribute('data-testid', 'prumo-barra');

    var estados = (corpo.getAttribute('data-prumo-estados') || '').split('|').filter(Boolean);
    var atual = corpo.getAttribute('data-prumo-estado');
    if (estados.length > 1) {
      var rotulo = document.createElement('label');
      rotulo.textContent = 'Estado ';
      rotulo.htmlFor = 'prumo-barra-estado';
      var sel = document.createElement('select');
      sel.id = 'prumo-barra-estado';
      sel.setAttribute('data-testid', 'prumo-barra-estado');
      estados.forEach(function (par) {
        var i = par.indexOf('=');
        var o = document.createElement('option');
        o.value = par.slice(i + 1);
        o.textContent = par.slice(0, i);
        if (par.slice(0, i) === atual) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        ir(sel.value);
      });
      rotulo.appendChild(sel);
      barra.appendChild(rotulo);
    }

    var simular = document.createElement('button');
    simular.type = 'button';
    simular.textContent = 'Simular erro';
    simular.setAttribute('data-testid', 'prumo-barra-simular');
    simular.setAttribute('aria-pressed', String(ler(CHAVE_SIMULAR, false)));
    simular.addEventListener('click', function (e) {
      e.stopPropagation();
      var v = !ler(CHAVE_SIMULAR, false);
      gravar(CHAVE_SIMULAR, v);
      simular.setAttribute('aria-pressed', String(v));
      anunciar(v ? 'Simular erro ligado: as ações mostram os erros dos cenários.' : 'Simular erro desligado.');
    });
    barra.appendChild(simular);

    var botaoVoltar = document.createElement('button');
    botaoVoltar.type = 'button';
    botaoVoltar.textContent = 'Voltar';
    botaoVoltar.setAttribute('data-testid', 'prumo-barra-voltar');
    botaoVoltar.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!percurso.length) anunciar('Não há tela anterior neste percurso.');
      else voltar();
    });
    barra.appendChild(botaoVoltar);

    status = document.createElement('span');
    status.setAttribute('role', 'status');
    status.setAttribute('data-testid', 'prumo-barra-aviso');
    barra.appendChild(status);

    corpo.appendChild(barra);
  }
  if (document.body) montarBarra();
  else document.addEventListener('DOMContentLoaded', montarBarra);
})();
