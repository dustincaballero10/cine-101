(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = (value) => '$' + Number(value || 0).toLocaleString('es-AR');

  const safeRead = (storage, key, fallback = null) => {
    try {
      return JSON.parse(storage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const save = (storage, key, value) => storage.setItem(key, JSON.stringify(value));
  const session = () => safeRead(localStorage, 'session');
  const loggedIn = () => Boolean(session()?.loggedIn);

  const requireLogin = () => {
    if (!loggedIn()) {
      location.replace(url('login.html'));
      return false;
    }
    return true;
  };

  // Datos compartidos desde reglas.js
  const R = window.Cine101;
  const movies = Object.fromEntries(Object.entries(R.PELICULAS).map(([k, v]) => [k, v.nombre]));
  const cinemas = R.CINES;
  const products = R.PRODUCTOS;

  // Rutas: el index está en la raíz y el resto de las páginas en html/
  const enHome = document.body.dataset.page === 'home';
  const url = (archivo) => (archivo.startsWith('index.html') ? (enHome ? '' : '../') + archivo : (enHome ? 'html/' : '') + archivo);

  // Utilidades de combos, compra y puntos
  const comboKey = () => 'combos:' + (R.usuarioActual()?.email || 'invitado');

  function finalizarCompra(order) {
    const user = R.usuarioActual();
    const registrado = Boolean(user && !user.invitado);
    const ganados = R.puntosGanados(order.granTotal);
    const compra = R.registrarCompra({
      email: registrado ? user.email : null,
      movie: order.movie,
      cine: order.cine.name,
      direccion: order.cine.address,
      fecha: order.fecha,
      hora: order.horario,
      formato: order.formato,
      asientos: order.asientos,
      combos: (order.combosSeleccionados || []).map((c) => c.nombre),
      total: order.granTotal,
      entradasTotal: order.asientosTotal,
      puntosUsados: order.puntosUsados || 0,
      puntosGanados: registrado ? ganados : 0,
      orden: { ...order }
    });
    if (registrado) {
      R.actualizarUsuario(user.email, {
        puntos: user.puntos - (order.puntosUsados || 0) + ganados,
        cumpleCanjeado: order.cumple ? new Date().getFullYear() : user.cumpleCanjeado
      });
    }
    save(sessionStorage, 'ordenFinal', { ...order, id: compra.id, puntosGanados: ganados });
    sessionStorage.removeItem('pedidoCombos');
  }

  function aplicarCambio(order) {
    const todas = R.leer('compras', []);
    const c = todas.find((x) => x.id === order.cambioId);
    if (!c) return;
    c.fecha = order.fecha;
    c.hora = order.horario;
    c.asientos = order.asientos;
    c.costoCambios = (c.costoCambios || 0) + order.granTotal;
    R.guardar('compras', todas);
    sessionStorage.removeItem('ordenFinal');
    sessionStorage.removeItem('seleccion');
  }

  function reclamarPuntos() {
    const reclamo = safeRead(sessionStorage, 'reclamo');
    const user = R.usuarioActual();
    if (!reclamo || !user || user.invitado) return 0;
    const todas = R.leer('compras', []);
    const compra = todas.find((c) => c.id === reclamo.id);
    if (compra && !compra.email) {
      compra.email = user.email;
      compra.puntosGanados = reclamo.puntos;
      R.guardar('compras', todas);
      R.actualizarUsuario(user.email, { puntos: user.puntos + reclamo.puntos });
    }
    const final = safeRead(sessionStorage, 'ordenFinal');
    if (final) save(sessionStorage, 'ordenFinal', { ...final, puntosReclamados: true });
    sessionStorage.removeItem('reclamo');
    return reclamo.puntos;
  }


  function initHeader() {
    const account = $('.account-slot');

    if (account) {
      const user = session();

      if (user?.loggedIn) {
        const name = [user.nombre, user.apellido].filter(Boolean).join(' ') || 'Invitado';
        const u = R.usuarioActual();
        account.innerHTML = '<a class="points-pill hidden" href="' + url('mis-entradas.html') + '"></a><span class="account-name"></span><a class="logout-link" href="#">Cerrar sesión</a>';
        if (u && !u.invitado) {
          const pill = $('.points-pill', account);
          pill.textContent = `${u.puntos.toLocaleString('es-AR')} pts`;
          pill.classList.remove('hidden');
        }
        $('.account-name', account).textContent = name;

        $('.logout-link', account).addEventListener('click', (event) => {
          event.preventDefault();
          localStorage.removeItem('session');
          location.href = url('index.html');
        });
      } else {
        account.innerHTML = '<a href="' + url('login.html') + '">Mi cuenta</a>';
      }
    }

    const wrap = $('.location-wrap');
    if (!wrap) return;

    const button = $('.nav-location', wrap);
    const input = $('input', wrap);
    const results = $('.location-results', wrap);
    const selected = localStorage.getItem('selectedLocation');

    if (selected) {
      button.firstChild.textContent = selected + ' ';
    }

    const render = () => {
      const needle = input.value.trim().toLocaleLowerCase('es');
      const options = ['Cine 101 Palermo', 'Cine 101 Recoleta', 'Cine 101 Belgrano']
        .filter((name) => name.toLocaleLowerCase('es').includes(needle))
        .map((name) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'location-option';
          item.textContent = name;

          item.addEventListener('click', () => {
            localStorage.setItem('selectedLocation', name);
            button.firstChild.textContent = name + ' ';
            wrap.classList.remove('open');
            button.setAttribute('aria-expanded', 'false');
            input.value = '';
            render();
          });

          return item;
        });

      results.replaceChildren(...options);
    };

    render();
    input.addEventListener('input', render);

    button.addEventListener('click', () => {
      const open = wrap.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
      if (open) input.focus();
    });

    document.addEventListener('click', (event) => {
      if (!wrap.contains(event.target)) {
        wrap.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initHome() {
    $$('[data-buy]').forEach((button) => {
      button.addEventListener('click', () => {
        const movie = button.dataset.buy;

        if (!loggedIn()) {
          location.href = url('login.html');
          return;
        }

        location.href = url(`seleccion.html?movie=${encodeURIComponent(movie)}`);
      });
    });
  }

  // Inicio de sesión y registro
  function initLogin() {
    const tabs = $$('.tab');
    const signIn = $('#signin-form');
    const register = $('#register-form');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((other) => other.classList.toggle('active', other === tab));
        signIn.classList.toggle('hidden', tab.dataset.tab !== 'signin');
        register.classList.toggle('hidden', tab.dataset.tab !== 'register');
      });
    });

    const afterLogin = () => {
      location.href = reclamarPuntos() ? url('ticket.html') : url('index.html');
    };

    const fail = (input, msg) => {
      input.setCustomValidity(msg);
      input.reportValidity();
      input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
    };

    signIn.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!signIn.reportValidity()) return;
      const res = R.iniciarSesion(signIn.elements.email.value, signIn.elements.password.value);
      if (!res.ok) return fail(signIn.elements.password, res.error);
      afterLogin();
    });

    register.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!register.reportValidity()) return;
      const f = register.elements;
      if (f.password.value !== f.confirm.value) return fail(f.confirm, 'Las contraseñas no coinciden.');
      const res = R.registrar({ nombre: f.nombre.value, apellido: f.apellido.value, email: f.email.value, password: f.password.value, nacimiento: f.nacimiento.value });
      if (!res.ok) return fail(f.email, res.error);
      R.iniciarSesion(f.email.value, f.password.value);
      afterLogin();
    });

    $$('[data-skip]').forEach((button) => {
      button.addEventListener('click', () => {
        R.entrarInvitado();
        location.href = url('index.html');
      });
    });
  }

  // Candy bar: prearmados y combos personalizados
  function initCandybar() {
    if (!requireLogin()) return;

    const list = $('#product-list');
    const totalText = $('#combo-total');
    const countText = $('#item-count');
    const preview = $('#combo-preview');
    const feedback = $('#combo-feedback');
    const key = comboKey();
    const orden = safeRead(sessionStorage, 'orden');
    const tope = orden ? R.maxCombos(orden.asientos.length) : R.CFG.maxCombosGlobal;
    const maxItems = R.CFG.maxArticulosCombo;

    const pedido = () => safeRead(sessionStorage, 'pedidoCombos', []) || [];
    const saved = () => safeRead(localStorage, key, []) || [];
    const msg = (text, ok) => {
      feedback.textContent = text;
      feedback.style.color = ok ? '#94cba7' : '#ff8a93';
    };

    if (orden) $('#return-summary').classList.remove('hidden');

    list.innerHTML = products
      .map(
        (product, i) => `
          <article class="product-row">
            <span class="product-icon">${product.icon}</span>
            <div class="product-copy">
              <h3>${product.name}</h3>
              <p>${money(product.price)} c/u</p>
            </div>
            <input class="quantity" type="number" min="0" max="${R.CFG.maxPorProducto}" value="0" aria-label="Cantidad de ${product.name}" data-index="${i}">
          </article>
        `
      )
      .join('');

    const priceTag = (combo) => {
      const p = R.precioCombo(combo);
      return p.pct ? `<del>${money(p.lista)}</del> <b>${money(p.total)}</b> <span class="discount-tag">${Math.round(p.pct * 100)}% OFF</span>` : `<b>${money(p.total)}</b>`;
    };

    const card = (combo) => `
      <article class="saved-combo">
        <strong>${combo.nombre}</strong>
        <p>${combo.items.map((item) => `${item.producto} × ${item.cantidad}`).join(' · ')}</p>
        <span>${priceTag(combo)}</span>
        <button type="button" class="button button-secondary" data-id="${combo.id}">${pedido().includes(combo.id) ? 'Quitar del pedido' : 'Sumar al pedido'}</button>
      </article>
    `;

    const render = () => {
      const mine = saved();
      $('#prearmados').innerHTML = R.PREARMADOS.map(card).join('');
      $('#saved-combos-section').classList.toggle('hidden', !mine.length);
      $('#saved-combos').innerHTML = mine.map(card).join('');
      $('#combo-count').textContent = `${pedido().length} de ${tope} combos en tu pedido`;
    };

    const refresh = (changed) => {
      const inputs = $$('.quantity', list);
      const values = inputs.map((input) => Math.max(0, Math.min(R.CFG.maxPorProducto, parseInt(input.value, 10) || 0)));
      const suma = values.reduce((sum, q) => sum + q, 0);

      if (changed && suma > maxItems) {
        const idx = inputs.indexOf(changed);
        values[idx] = Math.max(0, values[idx] - (suma - maxItems));
        msg(`Máximo ${maxItems} artículos por combo.`, false);
      }

      inputs.forEach((input, i) => {
        if (String(values[i]) !== input.value) input.value = values[i];
      });

      const items = values
        .map((q, i) => (q ? { producto: products[i].name, cantidad: q, precioUnitario: products[i].price, subtotal: q * products[i].price } : null))
        .filter(Boolean);
      const p = R.precioCombo({ tipo: 'personalizado', items });

      countText.textContent = items.reduce((sum, item) => sum + item.cantidad, 0);
      totalText.textContent = p.pct ? `${money(p.total)} (${Math.round(p.pct * 100)}% OFF)` : money(p.total);
      preview.innerHTML = items.length
        ? items.map((item) => `<div class="preview-row"><span>${item.producto} × ${item.cantidad}</span><span>${money(item.subtotal)}</span></div>`).join('')
        : 'Sumá algo rico para empezar.';
      return { items };
    };

    list.addEventListener('input', (event) => refresh(event.target));

    $('main').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-id]');
      if (!button) return;
      const ids = pedido();
      const id = button.dataset.id;
      if (ids.includes(id)) {
        ids.splice(ids.indexOf(id), 1);
      } else if (ids.length >= tope) {
        msg(`Máximo ${tope} combos${orden ? ` para ${orden.asientos.length} entradas` : ''}.`, false);
        return;
      } else {
        ids.push(id);
      }
      save(sessionStorage, 'pedidoCombos', ids);
      msg('', true);
      render();
    });

    $('#create-combo').addEventListener('click', () => {
      const { items } = refresh();
      if (!items.length) return msg('Elegí al menos un producto para crear tu combo.', false);

      const mine = saved();
      const numero = mine.reduce((max, c) => Math.max(max, c.numero || 0), 0) + 1;
      const combo = { id: `combo-${Date.now()}`, tipo: 'personalizado', numero, nombre: `Combo ${numero}`, items };
      save(localStorage, key, [...mine, combo]);
      $$('.quantity', list).forEach((input) => (input.value = 0));
      refresh();

      const ids = pedido();
      if (ids.length < tope) {
        ids.push(combo.id);
        save(sessionStorage, 'pedidoCombos', ids);
        msg(`${combo.nombre} creado y sumado a tu pedido.`, true);
      } else {
        msg(`${combo.nombre} guardado, pero ya llegaste al máximo de ${tope} combos.`, false);
      }
      render();
    });

    refresh();
    render();
  }

  // Selección de cine, día y horario
  function initSelection() {
    if (!requireLogin()) return;

    const movieId = new URLSearchParams(location.search).get('movie') || 'sexo';
    const peli = R.PELICULAS[movieId] || R.PELICULAS.sexo;
    $('#movie-context').textContent = `${peli.nombre} · ${peli.clasif}`;

    let cinema = null;
    let fecha = null;
    let hora = null;

    const cambioId = new URLSearchParams(location.search).get('cambio');
    const cambio = cambioId ? R.leer('compras', []).find((c) => c.id === cambioId) : null;
    if (cambioId && !(cambio && cambio.estado === 'activa' && R.puedeModificar(cambio.fecha, cambio.hora))) {
      location.replace(url('mis-entradas.html'));
      return;
    }

    const cinemaList = $('#cinema-list');
    const dayList = $('#day-list');
    const timeList = $('#time-list');

    const refresh = () => {
      const listo = cinema && fecha && hora;
      $('#continue-sel').disabled = !listo;
      $('#sel-summary').textContent = listo ? `${cinema.name} · ${fecha} · ${hora}` : 'Elegí cine, día y horario para continuar.';
    };

    const renderDays = () => {
      dayList.innerHTML = R.proximosDias()
        .map((d) => {
          const pct = cinema ? R.descuentoSedeDia(cinema.name, d.iso) : 0;
          return `<button type="button" class="time-button day-button${d.iso === fecha ? ' selected' : ''}" data-iso="${d.iso}"><span>${d.dia}</span><b>${d.num}</b>${pct ? `<small class="discount-tag">${Math.round(pct * 100)}% OFF</small>` : ''}</button>`;
        })
        .join('');
    };

    const renderTimes = () => {
      timeList.innerHTML = R.HORARIOS.map((h) => {
        const pasado = fecha && R.inicioFuncion(fecha, h) <= new Date();
        return `<button type="button" class="time-button${h === hora ? ' selected' : ''}" ${pasado ? 'disabled' : ''}>${h}</button>`;
      }).join('');
    };

    cinemaList.innerHTML = cinemas
      .map(
        (item, i) => `
          <button type="button" class="cinema-card" data-cinema="${i}">
            <span class="cinema-symbol">⌖</span>
            <strong>${item.name}</strong>
            <span>${item.address}</span>
          </button>
        `
      )
      .join('');

    cinemaList.addEventListener('click', (event) => {
      const card = event.target.closest('.cinema-card');
      if (!card || cambio) return;
      cinema = cinemas[Number(card.dataset.cinema)];
      fecha = null;
      hora = null;
      $$('.cinema-card', cinemaList).forEach((c) => c.classList.toggle('selected', c === card));
      $('#step-day').classList.remove('locked');
      $('#step-time').classList.add('locked');
      renderDays();
      renderTimes();
      refresh();
    });

    dayList.addEventListener('click', (event) => {
      const button = event.target.closest('.day-button');
      if (!button) return;
      fecha = button.dataset.iso;
      hora = null;
      $('#step-time').classList.remove('locked');
      renderDays();
      renderTimes();
      refresh();
    });

    timeList.addEventListener('click', (event) => {
      const button = event.target.closest('.time-button');
      if (!button || button.disabled) return;
      hora = button.textContent;
      renderTimes();
      refresh();
    });

    $('#continue-sel').addEventListener('click', () => {
      if (!(cinema && fecha && hora)) return;
      sessionStorage.removeItem('orden');
      save(sessionStorage, 'seleccion', { movie: movieId, cine: cinema, fecha, horario: hora, cambio: cambioId });
      location.href = url('asientos.html');
    });

    renderDays();
    renderTimes();

    if (cambio) {
      cinema = cinemas.find((c) => c.name === cambio.cine);
      $$('.cinema-card', cinemaList).forEach((c) => c.classList.toggle('selected', cinemas[Number(c.dataset.cinema)] === cinema));
      $('#step-day').classList.remove('locked');
      renderDays();
    }
  }

  // Formato, verificaciones y butacas
  function initAsientos() {
    if (!requireLogin()) return;

    const sel = safeRead(sessionStorage, 'seleccion');
    if (!sel) {
      location.replace(url('index.html'));
      return;
    }

    const peli = R.PELICULAS[sel.movie];
    const user = R.usuarioActual();
    let nacimiento = user?.nacimiento || '';
    const cambio = sel.cambio ? R.leer('compras', []).find((c) => c.id === sel.cambio) : null;
    let formato = cambio ? cambio.formato : null;
    const selectedSeats = new Set();
    const occupied = new Set(['IZQ-F1-A2', 'IZQ-F2-A5', 'CEN-F1-A3', 'CEN-F1-A4', 'CEN-F3-A7', 'CEN-F5-A1', 'DER-F1-A6', 'DER-F2-A2']);

    $('#movie-context').textContent = `${peli.nombre} · ${peli.clasif} · ${sel.cine.name} · ${sel.fecha} ${sel.horario}`;

    const formatList = $('#format-list');
    const ageBox = $('#age-box');
    const aviso = $('#aviso-4d');
    const acepto = $('#acepto-4d');
    const note = $('#seat-note');

    formatList.innerHTML = Object.entries(R.CFG.tarifas)
      .map(([f, p]) => `<button type="button" class="format-btn" data-f="${f}"><strong>${f}</strong><span>${money(p)} c/u</span></button>`)
      .join('');

    $('#age-input-wrap').classList.toggle('hidden', Boolean(user?.nacimiento));
    $('#age-input').max = new Date().toISOString().slice(0, 10);

    const checkAge = () => {
      const v = R.validarEdad(sel.movie, nacimiento);
      if (!nacimiento) return { ok: false, msg: 'Ingresá la fecha de nacimiento para validar la clasificación.' };
      if (!v.ok) return { ok: false, msg: `La película es ${peli.clasif} y tenés ${v.edad} años. No podés continuar.` };
      if (formato && R.es4D(formato) && v.edad < R.CFG.edadMin4D) return { ok: false, msg: `La sala 4D exige ${R.CFG.edadMin4D} años como mínimo.` };
      return { ok: true, msg: `Edad verificada (${v.edad} años) para ${peli.clasif}.` };
    };

    const refresh = () => {
      const age = checkAge();
      const is4D = Boolean(formato && R.es4D(formato));
      const n = selectedSeats.size;

      $('#age-msg').textContent = age.msg;
      ageBox.classList.toggle('ok', age.ok);
      ageBox.classList.toggle('bad', !age.ok);
      aviso.classList.toggle('hidden', !is4D);
      $('#step-seats').classList.toggle('locked', !formato);
      $$('.format-btn', formatList).forEach((b) => b.classList.toggle('selected', b.dataset.f === formato));

      let text = `${n} ${n === 1 ? 'asiento seleccionado' : 'asientos seleccionados'} — ${money(0)}`;
      if (formato) {
        const p = R.precioEntradas(formato, n, sel.cine.name, sel.fecha);
        text = `${n} ${n === 1 ? 'asiento seleccionado' : 'asientos seleccionados'} — ${money(p.total)}`;
        if (p.pct) text += ` (${Math.round(p.pct * 100)}% OFF sede y día: -${money(p.desc)})`;
      }
      $('#seat-counter').textContent = cambio ? `${n} de ${cambio.asientos.length} asientos — Cambio: ${money(R.costoCambio(cambio))} (25% del valor de las butacas)` : text;
      $('#continue-seats').disabled = !(formato && n && age.ok && (!is4D || acepto.checked) && (!cambio || n === cambio.asientos.length));
    };

    formatList.addEventListener('click', (event) => {
      const button = event.target.closest('.format-btn');
      if (!button || cambio) return;
      formato = button.dataset.f;
      acepto.checked = false;
      refresh();
    });

    acepto.addEventListener('change', refresh);
    $('#age-input').addEventListener('input', (event) => {
      nacimiento = event.target.value;
      refresh();
    });

    const seatMap = $('#seat-map');

    function renderSeats() {
      seatMap.innerHTML = '';

      [['IZQ', 2, 6], ['CEN', 5, 7], ['DER', 2, 6]].forEach(([block, rows, columns]) => {
        const group = document.createElement('div');
        group.className = 'seat-block';
        group.style.setProperty('--cols', columns);

        for (let row = 1; row <= rows; row++) {
          for (let col = 1; col <= columns; col++) {
            const id = `${block}-F${row}-A${col}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'seat-button';
            button.setAttribute('aria-label', id);
            button.title = id;

            const seat = document.createElement('span');
            seat.className = `seat${occupied.has(id) ? ' occupied' : selectedSeats.has(id) ? ' selected' : ''}`;
            button.appendChild(seat);

            if (occupied.has(id)) {
              button.disabled = true;
              button.setAttribute('aria-label', `${id}, ocupado`);
            } else {
              button.addEventListener('click', () => {
                note.textContent = '';
                if (selectedSeats.has(id)) {
                  selectedSeats.delete(id);
                } else if (selectedSeats.size >= R.CFG.maxEntradas) {
                  note.textContent = `Máximo ${R.CFG.maxEntradas} entradas por compra.`;
                  return;
                } else {
                  selectedSeats.add(id);
                }
                renderSeats();
                refresh();
              });
            }

            group.appendChild(button);
          }
        }

        seatMap.appendChild(group);
      });
    }

    renderSeats();
    refresh();

    $('#continue-seats').addEventListener('click', () => {
      if ($('#continue-seats').disabled) return;
      if (cambio) {
        save(sessionStorage, 'ordenFinal', { cambioId: cambio.id, movie: sel.movie, cine: sel.cine, fecha: sel.fecha, horario: sel.horario, asientos: [...selectedSeats], granTotal: R.costoCambio(cambio) });
        location.href = url('pago.html');
        return;
      }
      const p = R.precioEntradas(formato, selectedSeats.size, sel.cine.name, sel.fecha);
      save(sessionStorage, 'orden', {
        movie: sel.movie,
        cine: sel.cine,
        fecha: sel.fecha,
        horario: sel.horario,
        formato,
        asientos: [...selectedSeats],
        asientosBase: p.base,
        descSedeDia: p.desc,
        pctSedeDia: p.pct,
        asientosTotal: p.total,
        nacimiento
      });
      location.href = url('resumen.html');
    });
  }

  function initSummary() {
    if (!requireLogin()) return;

    const order = safeRead(sessionStorage, 'orden');
    if (!order) {
      location.replace(url('index.html'));
      return;
    }

    const user = R.usuarioActual();
    const registrado = Boolean(user && !user.invitado);
    const bonif = R.bonificacionCumple(user);
    const tope = R.maxCombos(order.asientos.length);
    const library = [...R.PREARMADOS, ...(safeRead(localStorage, comboKey(), []) || [])];
    let ids = (safeRead(sessionStorage, 'pedidoCombos', []) || []).filter((id) => library.some((c) => c.id === id));
    const options = $('#combo-options');
    const limit = $('#combo-limit');
    const pointsInput = $('#points-input');
    const show = (selector, on) => $(selector).classList.toggle('hidden', !on);

    $('#summary-movie').textContent = `${movies[order.movie] || order.movie} · ${R.PELICULAS[order.movie].clasif}`;
    $('#order-details').innerHTML = `
      <div class="detail-item"><span>Cine</span><strong>${order.cine.name}</strong></div>
      <div class="detail-item"><span>Día y horario</span><strong>${order.fecha} · ${order.horario}</strong></div>
      <div class="detail-item"><span>Formato</span><strong>${order.formato}</strong></div>
      <div class="detail-item"><span>Asientos</span><strong>${order.asientos.length} seleccionados</strong></div>
      <div class="detail-item full"><span>Tu ubicación</span><strong>${order.asientos.join(' · ')}</strong></div>
      <div class="detail-item"><span>Subtotal entradas</span><strong>${money(order.asientosTotal)}</strong></div>
    `;

    if (bonif) {
      show('#birthday-banner', true);
      $('#birthday-banner').innerHTML = `<h2>¡Feliz cumpleaños, ${user.nombre}!</h2><p>Te regalamos 1 entrada 3D y 1 combo simple (pochoclo chico + gaseosa 500ml) sin costo. Ya están aplicados en tu resumen.</p>`;
    }

    $('#points-balance').textContent = registrado ? `Saldo: ${user.puntos.toLocaleString('es-AR')} pts (1 punto = ${money(R.CFG.valorPunto)})` : 'Iniciá sesión para usar y acumular puntos.';
    pointsInput.closest('label').classList.toggle('hidden', !registrado);

    options.innerHTML = library
      .map((combo) => {
        const p = R.precioCombo(combo);
        const price = p.pct ? `<del>${money(p.lista)}</del><b>${money(p.total)}</b><span class="discount-tag">${Math.round(p.pct * 100)}% OFF</span>` : `<b>${money(p.total)}</b>`;
        return `
          <label class="combo-option">
            <input type="checkbox" data-id="${combo.id}" ${ids.includes(combo.id) ? 'checked' : ''}>
            <span class="combo-option-copy">
              <strong>${combo.nombre}</strong>
              <span>${combo.items.map((item) => `${item.producto} × ${item.cantidad}`).join(' · ')}</span>
            </span>
            <span class="combo-price">${price}</span>
          </label>
        `;
      })
      .join('');

    const calc = () => {
      const selected = library
        .filter((c) => ids.includes(c.id))
        .map((c) => {
          const p = R.precioCombo(c);
          return { ...c, totalOriginal: p.lista, total: p.total, pct: p.pct, discountApplied: p.pct > 0 };
        });
      const combosTotal = selected.reduce((sum, c) => sum + c.total, 0);
      const cumple = bonif ? { entrada: Math.min(bonif.entrada3D, order.asientosTotal), combo: bonif.combo, items: bonif.combo_items } : null;
      const previo = order.asientosTotal + combosTotal - (cumple ? cumple.entrada : 0);
      const puntos = registrado ? R.puntosAplicables(Number(pointsInput.value), user.puntos, previo) : 0;
      return { selected, combosTotal, cumple, puntos, total: previo - puntos * R.CFG.valorPunto };
    };

    const update = () => {
      const r = calc();
      if (registrado && pointsInput.value !== '' && Number(pointsInput.value) !== r.puntos) pointsInput.value = r.puntos;

      $('#seat-subtotal').textContent = money(order.asientosBase ?? order.asientosTotal);
      show('#disc-sede-line', order.descSedeDia > 0);
      $('#disc-sede-label').textContent = `Desc. sede y día (${Math.round((order.pctSedeDia || 0) * 100)}%)`;
      $('#disc-sede').textContent = '-' + money(order.descSedeDia);
      show('#combo-total-line', r.selected.length > 0);
      $('#combos-subtotal').textContent = money(r.combosTotal);
      show('#cumple-line', Boolean(r.cumple));
      $('#cumple-disc').textContent = r.cumple ? `-${money(r.cumple.entrada)} + combo simple gratis` : '';
      show('#puntos-line', r.puntos > 0);
      $('#puntos-disc').textContent = '-' + money(r.puntos * R.CFG.valorPunto);
      $('#grand-total').textContent = money(r.total);
      return r;
    };

    options.addEventListener('change', (event) => {
      const input = event.target;
      if (input.checked) {
        if (ids.length >= tope) {
          input.checked = false;
          limit.textContent = `Con ${order.asientos.length} entradas podés llevar hasta ${tope} combos.`;
          return;
        }
        ids.push(input.dataset.id);
      } else {
        ids = ids.filter((id) => id !== input.dataset.id);
      }
      limit.textContent = '';
      save(sessionStorage, 'pedidoCombos', ids);
      update();
    });

    pointsInput.addEventListener('input', update);

    $('#skip-candy').addEventListener('click', () => {
      ids = [];
      $$('.combo-option input').forEach((input) => (input.checked = false));
      save(sessionStorage, 'pedidoCombos', ids);
      limit.textContent = '';
      update();
    });

    update();

    $('#pay-order').addEventListener('click', () => {
      const r = update();
      save(sessionStorage, 'ordenFinal', { ...order, combosSeleccionados: r.selected, cumple: r.cumple, puntosUsados: r.puntos, granTotal: r.total });
      location.href = url('pago.html');
    });
  }

  function initPayment() {
    if (!requireLogin()) return;

    const order = safeRead(sessionStorage, 'ordenFinal');
    if (!order) {
      location.replace(url('index.html'));
      return;
    }

    $('#payment-total').textContent = money(order.granTotal);
    if (order.cambioId) $('.back-link').href = url('mis-entradas.html');

    const form = $('#payment-form');
    const card = form.elements.card;
    const expiry = form.elements.expiry;
    const cvv = form.elements.cvv;

    const digits = (input) => {
      input.value = input.value.replace(/\D/g, '');
    };

    card.addEventListener('input', () => {
      digits(card);
      card.value = card.value.slice(0, 16);
      card.setCustomValidity('');
    });

    cvv.addEventListener('input', () => {
      digits(cvv);
      cvv.value = cvv.value.slice(0, 3);
      cvv.setCustomValidity('');
    });

    expiry.addEventListener('input', () => {
      const value = expiry.value.replace(/\D/g, '').slice(0, 4);
      expiry.value = value.length > 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value;
      expiry.setCustomValidity('');
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      card.setCustomValidity(/^\d{16}$/.test(card.value) ? '' : 'Ingresá exactamente 16 dígitos.');
      cvv.setCustomValidity(/^\d{3}$/.test(cvv.value) ? '' : 'Ingresá exactamente 3 dígitos.');
      expiry.setCustomValidity(/^\d{2}\/\d{2}$/.test(expiry.value) ? '' : 'Ingresá el vencimiento como MM/YY.');

      if (!form.reportValidity()) return;

      const button = $('#pay-submit');
      button.disabled = true;
      button.innerHTML = 'Procesando pago…';
      setTimeout(() => {
        if (order.cambioId) {
          aplicarCambio(order);
          location.href = url('mis-entradas.html?cambiada=1');
          return;
        }
        finalizarCompra(order);
        location.href = url('ticket.html');
      }, 700);
    });
  }

  function initTicket() {
    if (!requireLogin()) return;

    const order = safeRead(sessionStorage, 'ordenFinal');
    if (!order) {
      location.replace(url('index.html'));
      return;
    }

    $('#ticket-movie').textContent = movies[order.movie] || order.movie;
    $('#ticket-details').innerHTML = `
      <div class="ticket-detail"><span>FECHA Y HORARIO</span><strong>${order.fecha} · ${order.horario} · ${order.formato}</strong></div>
      <div class="ticket-detail"><span>CINE</span><strong>${order.cine.name}</strong></div>
      <div class="ticket-detail"><span>DIRECCIÓN</span><strong>${order.cine.address}</strong></div>
    `;

    $('#ticket-seats').innerHTML = `
      <span class="ticket-seats-label">Asientos (${order.asientos.length}): ${money(order.asientosTotal)}</span>
      <div class="ticket-seat-list">${order.asientos.join(' · ')}</div>
    `;

    const selected = order.combosSeleccionados || [];
    $('#ticket-combos').innerHTML = selected
      .map(
        (combo) => `
          <div class="ticket-combo">
            <div class="ticket-combo-title">${combo.nombre}</div>
            <div class="ticket-combo-items">
              ${combo.items.map((item) => `${item.producto} x${item.cantidad} — ${money(item.subtotal)}`).join('<br>')}
            </div>
            <strong>
              Total combo ${combo.numero || combo.nombre.replace(/\D/g, '')}:
              ${combo.discountApplied ? `<del>${money(combo.totalOriginal)}</del> <span class="discount-tag">${Math.round(combo.pct * 100)}% OFF</span> ` : ''}
              ${money(combo.total)}
            </strong>
          </div>
        `
      )
      .join('');

    const extras = [];
    if (order.cumple) {
      extras.push(`<div class="ticket-combo"><div class="ticket-combo-title">Regalo de cumpleaños</div><div class="ticket-combo-items">1 entrada 3D sin costo (${money(order.cumple.entrada)})<br>Combo simple sin costo: ${order.cumple.items.map((i) => `${i.producto} x${i.cantidad}`).join(' + ')}</div></div>`);
    }
    if (order.puntosUsados) {
      extras.push(`<div class="ticket-combo"><div class="ticket-combo-title">Puntos usados</div><div class="ticket-combo-items">${order.puntosUsados} puntos (-${money(order.puntosUsados * R.CFG.valorPunto)})</div></div>`);
    }
    $('#ticket-combos').insertAdjacentHTML('beforeend', extras.join(''));

    $('#ticket-total').textContent = money(order.granTotal);
    $('#reservation-code').textContent = order.id;
    $('.qr-wrap img').src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${order.id}`;

    const claimUser = R.usuarioActual();
    const claimBox = $('#claim-box');
    if (claimUser && !claimUser.invitado && order.puntosGanados) {
      $('#claim-text').textContent = `Sumaste ${order.puntosGanados} puntos con esta compra. Tu saldo es de ${claimUser.puntos.toLocaleString('es-AR')} puntos.`;
      $('#claim-btn').classList.add('hidden');
      claimBox.classList.remove('hidden');
    } else if (order.puntosGanados) {
      $('#claim-text').textContent = `¿Reclamar puntos? Ganaste ${order.puntosGanados} puntos con esta compra. Iniciá sesión o registrate para sumarlos a tu cuenta.`;
      claimBox.classList.remove('hidden');
      $('#claim-btn').addEventListener('click', () => {
        save(sessionStorage, 'reclamo', { id: order.id, puntos: order.puntosGanados });
        location.href = url('login.html');
      });
    }

    const qr = $('.qr-wrap img');
    qr.addEventListener('error', () => {
      qr.style.display = 'none';
      $('.qr-fallback').style.display = 'grid';
    });

    $('#back-home').addEventListener('click', () => {
      sessionStorage.removeItem('orden');
      sessionStorage.removeItem('ordenFinal');
      sessionStorage.removeItem('comboReturn');
      location.href = url('index.html');
    });
  }

  // Mis entradas: historial, cancelar y cambiar
  function initMisEntradas() {
    if (!requireLogin()) return;

    const list = $('#purchase-list');
    const fb = $('#me-feedback');
    const user = R.usuarioActual();

    if (!user || user.invitado) {
      list.innerHTML = '<div class="no-combos">Iniciá sesión para ver tus entradas y tus puntos. <a class="text-link" href="' + url('login.html') + '">Ir a Mi cuenta <span>→</span></a></div>';
      return;
    }

    if (new URLSearchParams(location.search).get('cambiada')) {
      fb.textContent = 'Función cambiada. Tus nuevos asientos ya están reservados.';
      fb.style.color = '#94cba7';
    }

    const card = (c) => {
      const puede = c.estado === 'activa' && R.puedeModificar(c.fecha, c.hora);
      const pts = [c.puntosGanados ? `+${c.puntosGanados} pts` : '', c.puntosUsados ? `-${c.puntosUsados} pts usados` : ''].filter(Boolean).join(' · ');
      return `
        <article class="purchase-card ${c.estado}">
          <div>
            <span class="summary-chip">${c.estado === 'activa' ? 'ACTIVA' : 'CANCELADA'}</span>
            <h2>${movies[c.movie] || c.movie}</h2>
            <p>${c.cine} · ${c.fecha} · ${c.hora} · ${c.formato}</p>
            <p>Asientos: ${c.asientos.join(' · ')}</p>
            ${c.combos.length ? `<p>Combos: ${c.combos.join(', ')}</p>` : ''}
            ${c.costoCambios ? `<p>Cambios abonados: ${money(c.costoCambios)}</p>` : ''}
            <p><b>${money(c.total)}</b> ${pts}</p>
            <small>${c.id}</small>
          </div>
          <div class="purchase-actions">
            ${c.estado === 'activa' ? `<button class="button" data-act="ticket" data-id="${c.id}">Ver ticket</button>` : ''}
            <button class="button button-secondary" data-act="cambiar" data-id="${c.id}" ${puede ? '' : 'disabled'}>Cambiar (+${money(R.costoCambio(c))})</button>
            <button class="button button-secondary" data-act="cancelar" data-id="${c.id}" ${puede ? '' : 'disabled'}>Devolver entradas</button>
            ${c.estado === 'activa' && !puede ? '<small>Solo hasta 2 horas antes de la función.</small>' : ''}
          </div>
        </article>
      `;
    };

    const render = () => {
      const actual = R.usuarioActual();
      $('#points-summary').textContent = `Saldo de puntos: ${actual.puntos.toLocaleString('es-AR')}`;
      const compras = R.comprasDe(actual.email).reverse();
      list.innerHTML = compras.length ? compras.map(card).join('') : '<div class="no-combos">Todavía no tenés compras.</div>';
    };

    list.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-act]');
      if (!button || button.disabled) return;
      const id = button.dataset.id;

      if (button.dataset.act === 'ticket') {
        const c = R.leer('compras', []).find((x) => x.id === id);
        const base = c.orden || { movie: c.movie, cine: { name: c.cine, address: c.direccion || '' }, asientosTotal: c.entradasTotal ?? R.CFG.tarifas[c.formato] * c.asientos.length, combosSeleccionados: [], granTotal: c.total, puntosUsados: c.puntosUsados };
        save(sessionStorage, 'ordenFinal', { ...base, fecha: c.fecha, horario: c.hora, formato: c.formato, asientos: c.asientos, id: c.id, puntosGanados: c.puntosGanados || 0 });
        location.href = url('ticket.html');
        return;
      }

      if (button.dataset.act === 'cancelar') {
        if (!confirm('¿Querés devolver estas entradas?')) return;
        const res = R.cancelarCompra(id);
        fb.textContent = res.ok ? `Entradas devueltas.${res.devueltos ? ` +${res.devueltos} puntos devueltos.` : ''}` : res.error;
        fb.style.color = res.ok ? '#94cba7' : '#ff8a93';
        render();
        return;
      }

      const compra = R.leer('compras', []).find((c) => c.id === id);
      if (!confirm(`Cambiar la función cuesta ${money(R.costoCambio(compra))} (25% del valor de las butacas). ¿Continuar?`)) return;
      location.href = url(`seleccion.html?movie=${compra.movie}&cambio=${id}`);
    });

    render();
  }

  initHeader();
  const page = document.body.dataset.page;

  ({
    home: initHome,
    login: initLogin,
    candybar: initCandybar,
    seleccion: initSelection,
    asientos: initAsientos,
    'mis-entradas': initMisEntradas,
    resumen: initSummary,
    pago: initPayment,
    ticket: initTicket
  }[page] || (() => {}))();
})();
