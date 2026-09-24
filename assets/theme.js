/* Gloss theme – vanilla JS, no dependencies */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Mobile drawer ------------------------------------------------------- */
  function initDrawer(root) {
    var drawer = $('[data-drawer]', root);
    var openBtn = $('[data-menu-open]', root);
    if (!drawer || !openBtn) return;
    function open() { drawer.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; var c = $('[data-menu-close]', drawer); if (c) c.focus(); }
    function close() { drawer.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; openBtn.focus(); }
    openBtn.addEventListener('click', open);
    $$('[data-menu-close]', drawer).forEach(function (b) { b.addEventListener('click', close); });
    drawer.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* Search dropdown: focus input, close on Escape ----------------------- */
  function initSearch(root) {
    var d = $('[data-search]', root);
    if (!d) return;
    d.addEventListener('toggle', function () {
      if (d.open) { var i = $('input[type=search]', d); if (i) i.focus(); }
    });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.open = false; });
  }

  /* Hero slideshow ------------------------------------------------------ */
  function initSlideshow(root) {
    var slides = $$('[data-slide]', root);
    if (!slides.length) return;
    var dots = $$('[data-dot]', root);
    var i = 0, timer = null;
    function go(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var auto = root.dataset.autoplay === 'true' && slides.length > 1 && !reduce;
    function start() { if (auto && !timer) timer = setInterval(function () { go(i + 1); }, (parseInt(root.dataset.interval, 10) || 6) * 1000); }
    function stop() { clearInterval(timer); timer = null; }
    dots.forEach(function (d, k) { d.addEventListener('click', function () { stop(); go(k); start(); }); });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { stop(); go(i + (dx < 0 ? 1 : -1)); start(); }
    });
    root.addEventListener('shopify:block:select', function (e) { stop(); go(slides.indexOf(e.target)); });
    root.addEventListener('shopify:block:deselect', start);
    start();
  }

  /* Quantity steppers (product + cart) --------------------------------- */
  function initQty(root) {
    $$('.qty', root).forEach(function (q) {
      var input = $('input', q);
      function bounds() {
        var min = parseInt(input.getAttribute('min'), 10); if (isNaN(min)) min = 1;
        var step = parseInt(input.getAttribute('step'), 10); if (isNaN(step) || step < 1) step = 1;
        var maxAttr = input.getAttribute('max');
        var max = maxAttr ? parseInt(maxAttr, 10) : Infinity;
        return { min: min, step: step, max: max };
      }
      function set(v) {
        var b = bounds();
        var clamped = Math.min(b.max, Math.max(b.min, v));
        input.value = clamped;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var minus = $('[data-qty-minus]', q), plus = $('[data-qty-plus]', q);
      if (minus) minus.addEventListener('click', function () { var b = bounds(); set((parseInt(input.value, 10) || b.min) - b.step); });
      if (plus) plus.addEventListener('click', function () { var b = bounds(); set((parseInt(input.value, 10) || 0) + b.step); });
    });
  }

  /* Cart page: auto-update when quantity changes ----------------------- */
  function initCart(root) {
    var form = $('[data-cart-form]', root);
    if (!form) return;
    var t;
    form.addEventListener('change', function (e) {
      if (!e.target.matches('[data-cart-qty]')) return;
      clearTimeout(t);
      t = setTimeout(function () {
        var h = document.createElement('input');
        h.type = 'hidden'; h.name = 'update'; h.value = 'true';
        form.appendChild(h);
        form.submit();
      }, 600);
    });
  }

  /* Product page: gallery + variants ----------------------------------- */
  function money(cents) {
    var cur = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'SEK';
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: 'currency', currency: cur, minimumFractionDigits: cents % 100 === 0 ? 0 : 2
      }).format(cents / 100);
    } catch (err) { return (cents / 100).toFixed(2) + ' ' + cur; }
  }

  function initProduct(root) {
    var wrap = $('[data-product]', root);
    if (!wrap) return;

    // Gallery
    var slides = $$('[data-media]', wrap), thumbs = $$('[data-thumb]', wrap);
    function show(id) {
      slides.forEach(function (s) { s.classList.toggle('is-active', s.dataset.media === String(id)); });
      thumbs.forEach(function (t) { t.setAttribute('aria-current', t.dataset.thumb === String(id) ? 'true' : 'false'); });
    }
    thumbs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.thumb); }); });
    if (thumbs[0] && !$('.gallery__slide.is-active[data-media]', wrap)) show(thumbs[0].dataset.thumb);

    // Variants
    var form = $('[data-product-form]', wrap), json = $('[data-product-json]', wrap);
    if (!form || !json) return;
    var product = JSON.parse(json.textContent);
    // Any of these blocks may have been removed or reordered by the merchant, so every lookup is optional.
    var idInput = $('[name=id]', form), btn = $('[data-add]', form), label = $('[data-add-label]', form);
    var priceEl = $('[data-price-current]', wrap), compareEl = $('[data-price-compare]', wrap), sku = $('[data-sku]', wrap);
    var qtyInput = $('[data-qty-input]', wrap), qtyHint = $('[data-qty-hint]', wrap);
    var qtyBlock = $('[data-qty-block]', wrap), volumeBox = $('[data-volume-pricing]', wrap), volumeList = $('[data-volume-list]', wrap);
    var addText = wrap.dataset.addText, soldText = wrap.dataset.soldOutText;

    form.addEventListener('change', function (e) {
      if (!e.target.closest('[data-option]')) return;
      var chosen = $$('[data-option]', form).map(function (f) { var c = $('input:checked', f); return c ? c.value : null; });
      var v = product.variants.filter(function (v) { return v.options.every(function (o, k) { return o === chosen[k]; }); })[0];
      update(v);
    });

    function update(v) {
      if (!v) { if (btn) btn.disabled = true; return; }
      if (idInput) idInput.value = v.id;
      if (btn) btn.disabled = !v.available;
      if (label) label.textContent = v.available ? addText : soldText;
      if (priceEl) priceEl.textContent = money(v.price);
      if (compareEl) {
        if (v.compare_at_price && v.compare_at_price > v.price) { compareEl.textContent = money(v.compare_at_price); compareEl.hidden = false; }
        else { compareEl.hidden = true; }
      }
      if (sku) sku.textContent = v.sku || '';
      if (v.featured_media && v.featured_media.id) show(v.featured_media.id);

      // B2B: quantity rules (min / max / increment) and volume pricing, when present on the variant.
      var rule = v.quantity_rule || { min: 1, max: null, increment: 1 };
      if (qtyInput) {
        qtyInput.min = rule.min || 1;
        qtyInput.step = rule.increment || 1;
        if (rule.max) qtyInput.max = rule.max; else qtyInput.removeAttribute('max');
        if ((parseInt(qtyInput.value, 10) || 0) < rule.min) qtyInput.value = rule.min;
      }
      var hasRule = (rule.increment && rule.increment > 1) || (rule.min && rule.min > 1) || rule.max;
      if (qtyHint && qtyBlock) {
        qtyHint.hidden = !hasRule;
        if (hasRule) qtyHint.textContent = qtyBlock.dataset.hintTemplate.replace('§MIN§', rule.min || 1).replace('§STEP§', rule.increment || 1);
      }
      var breaks = v.quantity_price_breaks || [];
      if (volumeBox && volumeList) {
        volumeBox.hidden = breaks.length === 0;
        if (breaks.length > 0) {
          var rows = '<li><span>' + volumeBox.dataset.minTemplate.replace('§MIN§', rule.min || 1) + '</span> <span>' + money(v.price) + ' / ' + volumeBox.dataset.each + '</span></li>';
          breaks.forEach(function (b) { rows += '<li><span>' + b.minimum_quantity + '+</span> <span>' + money(b.price) + ' / ' + volumeBox.dataset.each + '</span></li>'; });
          volumeList.innerHTML = rows;
        }
      }

      var url = new URL(window.location.href);
      url.searchParams.set('variant', v.id);
      window.history.replaceState({}, '', url.toString());
    }
  }

  /* Collection filters -------------------------------------------------- */
  function initFilters(root) {
    var form = $('[data-filters]', root);
    if (!form) return;
    var toggle = $('[data-filter-toggle]', form), panel = $('[data-filter-panel]', form);
    if (toggle && panel) toggle.addEventListener('click', function () { panel.classList.toggle('is-open'); });
    var t;
    form.addEventListener('change', function () {
      clearTimeout(t);
      t = setTimeout(function () { form.submit(); }, 250);
    });
  }

  /* Product recommendations -------------------------------------------- */
  function initRecommendations(root) {
    $$('[data-recommendations]', root).forEach(function (el) {
      var url = el.dataset.url;
      if (!url || !window.fetch) return;
      fetch(url).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = $('[data-recommendations]', doc);
        if (fresh && fresh.innerHTML.trim()) {
          el.innerHTML = fresh.innerHTML;
          $$('[data-carousel]', el).forEach(initCarousel);
        }
      }).catch(function () {});
    });
  }

  /* Login: toggle recover password ------------------------------------- */
  function initAuth(root) {
    var toggles = $$('[data-recover-toggle]', root);
    if (!toggles.length) return;
    var login = $('#login', root), rec = $('#recover', root);
    function sync() { var show = window.location.hash === '#recover'; rec.hidden = !show; login.hidden = show; }
    toggles.forEach(function (a) { a.addEventListener('click', function () { setTimeout(sync, 0); }); });
    window.addEventListener('hashchange', sync);
    sync();
  }


  /* Product carousel ---------------------------------------------------- */
  function initCarousel(root) {
    var track = $('[data-track]', root);
    if (!track) return;
    var prev = $('[data-prev]', root), next = $('[data-next]', root);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var raf = null;
    function update() {
      raf = null;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    }
    function queue() { if (!raf) raf = requestAnimationFrame(update); }
    function move(dir) { track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: reduce ? 'auto' : 'smooth' }); }
    if (prev) prev.addEventListener('click', function () { move(-1); });
    if (next) next.addEventListener('click', function () { move(1); });
    track.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();
  }

  /* Quick add (delegated once) ----------------------------------------- */
  function closePanels(except) {
    $$('[data-variants-panel]').forEach(function (p) {
      if (p === except) return;
      p.hidden = true;
      var b = $('[data-quick-open]', p.closest('[data-card]'));
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function refreshCartCount() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (cart) {
      $$('[data-cart-count]').forEach(function (el) { el.textContent = cart.item_count; el.classList.toggle('is-empty', cart.item_count === 0); });
    });
  }
  document.addEventListener('click', function (e) {
    var open = e.target.closest('[data-quick-open]');
    if (open) {
      var panel = $('[data-variants-panel]', open.closest('[data-card]'));
      var willOpen = panel.hidden;
      closePanels(willOpen ? panel : null);
      panel.hidden = !willOpen;
      open.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (willOpen) { var f = $('button:not([disabled])', $('.card__variants-list', panel)); if (f) f.focus(); }
      return;
    }
    if (e.target.closest('[data-quick-close]')) {
      var card = e.target.closest('[data-card]');
      closePanels(null);
      var ob = $('[data-quick-open]', card); if (ob) ob.focus();
      return;
    }
    var add = e.target.closest('[data-quick-add]');
    if (add) {
      var card2 = add.closest('[data-card]');
      var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      var trigger = $('.card__add', card2);
      var label = $('[data-add-label]', trigger) || trigger.querySelector('span:last-child');
      var original = label ? label.textContent : '';
      add.disabled = true;
      if (label && add === trigger) label.textContent = card2.dataset.addingText;
      fetch(root + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(add.dataset.variantId), quantity: 1 }] })
      }).then(function (r) { if (!r.ok) throw new Error('add failed'); return r.json(); })
        .then(refreshCartCount)
        .then(function () {
          closePanels(null);
          trigger.classList.add('is-done');
          if (label) label.textContent = card2.dataset.addedText;
          setTimeout(function () { trigger.classList.remove('is-done'); if (label) label.textContent = original; add.disabled = false; }, 1800);
        })
        .catch(function () {
          add.disabled = false;
          if (label) { label.textContent = card2.dataset.errorText; setTimeout(function () { label.textContent = original; }, 2200); }
        });
      return;
    }
    if (!e.target.closest('[data-variants-panel]')) closePanels(null);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanels(null); });

  /* Transparent header: measure height + toggle solid state on scroll --- */
  function applyHeaderOverlay() {
    var header = $('.header');
    if (!header || !header.classList.contains('header--transparent')) return;
    var main = document.getElementById('MainContent');
    var first = main && main.firstElementChild;
    if (!first) return;
    var hero = first.querySelector('.hero');
    if (hero) {
      hero.classList.add('hero--behind-header');
    } else {
      first.classList.add('is-behind-header');
    }
  }

  function initTransparentHeader() {
    var header = $('.header');
    if (!header || header.dataset.tInit) return;
    header.dataset.tInit = 'true';
    var resizeTimer;
    function setHeight() { document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px'); }
    function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
    setHeight();
    onScroll();
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(setHeight, 150); });
    window.addEventListener('scroll', onScroll, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setHeight);

    // If the header is transparent, automatically let the very first section on the
    // page sit behind it (no need to also flip a matching setting on that section).
    applyHeaderOverlay();
  }

  function init(root) {
    initDrawer(root); initSearch(root);
    $$('[data-slideshow]', root).forEach(initSlideshow);
    $$('[data-carousel]', root).forEach(initCarousel);
    initQty(root); initCart(root); initProduct(root); initFilters(root); initRecommendations(root); initAuth(root);
  }

  document.addEventListener('DOMContentLoaded', function () { init(document); initTransparentHeader(); });
  document.addEventListener('shopify:section:load', function (e) { init(e.target); if ($('.header', e.target)) initTransparentHeader(); applyHeaderOverlay(); });
})();
