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
      location.replace('login.html');
      return false;
    }
    return true;
  };

  const movies = {
    sexo: 'Sexo: La película',
    wicked: 'Wicked',
    redone: 'Red One',
    smile2: 'Smile 2',
    sonrie: 'Sonríe'
  };

  const cinemas = [
    { name: 'Cine 101 Palermo', address: 'Av. Santa Fe 3253, Palermo, CABA' },
    { name: 'Cine 101 Recoleta', address: 'Av. Callao 1750, Recoleta, CABA' },
    { name: 'Cine 101 Belgrano', address: 'Av. Cabildo 2280, Belgrano, CABA' }
  ];

  const products = [
    { name: 'Pochoclo chico', price: 1200, icon: '✳' },
    { name: 'Pochoclo grande', price: 1800, icon: '✴' },
    { name: 'Gaseosa 500ml', price: 900, icon: '◒' },
    { name: 'Agua mineral', price: 700, icon: '◉' },
    { name: 'Nachos con queso', price: 1800, icon: '⌁' },
    { name: 'Chocolate/Golosina', price: 1000, icon: '▰' }
  ];

  function initHeader() {
    const account = $('.account-slot');

    if (account) {
      const user = session();

      if (user?.loggedIn) {
        const name = [user.nombre, user.apellido].filter(Boolean).join(' ') || 'Invitado';
        account.innerHTML = '<span class="account-name"></span><a class="logout-link" href="#">Cerrar sesión</a>';
        $('.account-name', account).textContent = name;

        $('.logout-link', account).addEventListener('click', (event) => {
          event.preventDefault();
          localStorage.removeItem('session');
          location.href = 'index.html';
        });
      } else {
        account.innerHTML = '<a href="login.html">Mi cuenta</a>';
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
          location.href = 'login.html';
          return;
        }

        location.href = `seleccion.html?movie=${encodeURIComponent(movie)}`;
      });
    });
  }

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

    const finish = (nombre, apellido) => {
      save(localStorage, 'session', {
        loggedIn: true,
        nombre: nombre.trim(),
        apellido: apellido.trim()
      });
      location.href = 'index.html';
    };

    signIn.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!signIn.reportValidity()) return;
      finish(signIn.elements.nombre.value, signIn.elements.apellido.value);
    });

    register.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!register.reportValidity()) return;

      if (register.elements.password.value !== register.elements.confirm.value) {
        register.elements.confirm.setCustomValidity('Las contraseñas no coinciden.');
        register.elements.confirm.reportValidity();
        register.elements.confirm.addEventListener('input', () => register.elements.confirm.setCustomValidity(''), { once: true });
        return;
      }

      finish(register.elements.nombre.value, register.elements.apellido.value);
    });

    $$('[data-skip]').forEach((button) => {
      button.addEventListener('click', () => finish('Invitado', ''));
    });
  }

  function initCandybar() {
    if (!requireLogin()) return;

    const list = $('#product-list');
    const totalText = $('#combo-total');
    const countText = $('#item-count');
    const preview = $('#combo-preview');
    const feedback = $('#combo-feedback');
    const returning = sessionStorage.getItem('comboReturn') === 'summary' || new URLSearchParams(location.search).get('return') === 'summary';

    if (returning) {
      sessionStorage.setItem('comboReturn', 'summary');
      $('#return-summary').classList.remove('hidden');
    }

    list.innerHTML = products
      .map(
        (product, i) => `
          <article class="product-row">
            <span class="product-icon">${product.icon}</span>
            <div class="product-copy">
              <h3>${product.name}</h3>
              <p>${money(product.price)} c/u</p>
            </div>
            <input
              class="quantity"
              type="number"
              min="0"
              max="10"
              value="0"
              aria-label="Cantidad de ${product.name}"
              data-index="${i}"
            >
          </article>
        `
      )
      .join('');

    const refresh = () => {
      const values = $$('.quantity', list).map((input) => Math.max(0, Math.min(10, parseInt(input.value, 10) || 0)));

      $$('.quantity', list).forEach((input, i) => {
        if (String(values[i]) !== input.value) input.value = values[i];
      });

      const itemCount = values.reduce((sum, quantity) => sum + quantity, 0);
      const total = values.reduce((sum, quantity, i) => sum + quantity * products[i].price, 0);

      countText.textContent = itemCount;
      totalText.textContent = money(total);

      const selected = values
        .map((quantity, i) => {
          if (!quantity) return '';
          return `
            <div class="preview-row">
              <span>${products[i].name} × ${quantity}</span>
              <span>${money(quantity * products[i].price)}</span>
            </div>
          `;
        })
        .filter(Boolean);

      preview.innerHTML = selected.length ? selected.join('') : 'Sumá algo rico para empezar.';
      return { values, itemCount, total };
    };

    list.addEventListener('input', refresh);
    refresh();

    $('#create-combo').addEventListener('click', () => {
      const { values, itemCount } = refresh();

      if (!itemCount) {
        feedback.textContent = 'Elegí al menos un producto para crear tu combo.';
        feedback.style.color = '#ff8a93';
        return;
      }

      const combos = safeRead(localStorage, 'combos', []) || [];
      const number = combos.reduce((max, combo) => Math.max(max, Number((combo.nombre || '').match(/\d+/)?.[0] || 0), Number(combo.numero || 0)), 0) + 1;

      const items = values
        .map((quantity, i) => {
          if (!quantity) return null;
          return {
            producto: products[i].name,
            cantidad: quantity,
            precioUnitario: products[i].price,
            subtotal: quantity * products[i].price
          };
        })
        .filter(Boolean);

      const total = items.reduce((sum, item) => sum + item.subtotal, 0);
      combos.push({
        id: `combo-${Date.now()}-${number}`,
        nombre: `Combo ${number}`,
        numero: number,
        items,
        total
      });

      save(localStorage, 'combos', combos);
      $$('.quantity', list).forEach((input) => (input.value = 0));
      refresh();

      feedback.textContent = `Combo ${number} guardado. ¡Que lo disfrutes!`;
      feedback.style.color = '#94cba7';
      renderSavedCombos();

      if (returning) {
        $('#return-summary').textContent = 'Volver al resumen →';
      }
    });

    function renderSavedCombos() {
      const combos = safeRead(localStorage, 'combos', []) || [];
      const section = $('#saved-combos-section');
      const target = $('#saved-combos');

      if (!combos.length) return;

      section.classList.remove('hidden');
      target.innerHTML = combos
        .map(
          (combo) => `
            <article class="saved-combo">
              <strong>${combo.nombre}</strong>
              <p>${combo.items.map((item) => `${item.producto} × ${item.cantidad}`).join(' · ')}</p>
              <b>${money(combo.total)}</b>
            </article>
          `
        )
        .join('');
    }

    renderSavedCombos();
  }

  function initSelection() {
    if (!requireLogin()) return;

    const movieId = new URLSearchParams(location.search).get('movie') || 'sexo';
    $('#movie-context').textContent = movies[movieId] || movies.sexo;

    const cinemaList = $('#cinema-list');
    const timeList = $('#time-list');
    const seatMap = $('#seat-map');

    let cinema = null;
    let time = null;
    const selectedSeats = new Set();

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

    $$('.cinema-card', cinemaList).forEach((card) => {
      card.addEventListener('click', () => {
        cinema = cinemas[Number(card.dataset.cinema)];
        $$('.cinema-card', cinemaList).forEach((c) => c.classList.toggle('selected', c === card));

        $('#step-time').classList.remove('locked');
        $('#step-seats').classList.add('locked');
        time = null;
        selectedSeats.clear();
        renderSeats();
        $$('.time-button', timeList).forEach((c) => c.classList.remove('selected'));
      });
    });

    timeList.innerHTML = ['14:30', '17:15', '20:00', '22:45']
      .map((value) => `<button type="button" class="time-button">${value}</button>`)
      .join('');

    $$('.time-button', timeList).forEach((button) => {
      button.addEventListener('click', () => {
        time = button.textContent;
        $$('.time-button', timeList).forEach((c) => c.classList.toggle('selected', c === button));
        $('#step-seats').classList.remove('locked');
      });
    });

    const occupied = new Set(['IZQ-F1-A2', 'IZQ-F2-A5', 'CEN-F1-A3', 'CEN-F1-A4', 'CEN-F3-A7', 'CEN-F5-A1', 'DER-F1-A6', 'DER-F2-A2']);

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
                if (selectedSeats.has(id)) selectedSeats.delete(id);
                else selectedSeats.add(id);
                renderSeats();
              });
            }

            group.appendChild(button);
          }
        }

        seatMap.appendChild(group);
      });

      const amount = selectedSeats.size * 3000;
      $('#seat-counter').textContent = `${selectedSeats.size} ${selectedSeats.size === 1 ? 'asiento seleccionado' : 'asientos seleccionados'} — ${money(amount)}`;
      $('#continue-seats').disabled = selectedSeats.size === 0;
    }

    renderSeats();

    $('#continue-seats').addEventListener('click', () => {
      if (!cinema || !time || !selectedSeats.size) return;
      save(sessionStorage, 'orden', {
        movie: movieId,
        cine: cinema,
        horario: time,
        asientos: [...selectedSeats],
        asientosTotal: selectedSeats.size * 3000
      });
      location.href = 'resumen.html';
    });
  }

  function initSummary() {
    if (!requireLogin()) return;

    const order = safeRead(sessionStorage, 'orden');
    if (!order) {
      location.replace('index.html');
      return;
    }

    $('#summary-movie').textContent = movies[order.movie] || order.movie;
    $('#order-details').innerHTML = `
      <div class="detail-item"><span>Cine</span><strong>${order.cine.name}</strong></div>
      <div class="detail-item"><span>Horario</span><strong>${order.horario}</strong></div>
      <div class="detail-item"><span>Asientos</span><strong>${order.asientos.length} seleccionados</strong></div>
      <div class="detail-item full"><span>Tu ubicación</span><strong>${order.asientos.join(' · ')}</strong></div>
      <div class="detail-item"><span>Subtotal entradas</span><strong>${money(order.asientosTotal)}</strong></div>
    `;

    const combos = safeRead(localStorage, 'combos', []) || [];
    const options = $('#combo-options');

    if (!combos.length) {
      options.innerHTML = '<div class="no-combos">Todavía no tenés combos guardados. Si querés, podés crear uno ahora.</div>';
    } else {
      options.innerHTML = combos
        .map((combo) => {
          const discount = combo.total > 40000;
          const total = discount ? Math.round(combo.total * 0.8) : combo.total;

          return `
            <label class="combo-option">
              <input type="checkbox" data-id="${combo.id}">
              <span class="combo-option-copy">
                <strong>${combo.nombre}</strong>
                <span>${combo.items.map((item) => `${item.producto} × ${item.cantidad}`).join(' · ')}</span>
              </span>
              <span class="combo-price">
                ${
                  discount
                    ? `<del>${money(combo.total)}</del><b>${money(total)}</b><span class="discount-tag">20% OFF</span>`
                    : `<b>${money(total)}</b>`
                }
              </span>
            </label>
          `;
        })
        .join('');
    }

    const newCombo = $('#new-combo');
    newCombo.addEventListener('click', () => sessionStorage.setItem('comboReturn', 'summary'));

    function updateTotal() {
      const selected = $$('.combo-option input:checked').map((input) => {
        const combo = combos.find((item) => item.id === input.dataset.id);
        const discountedTotal = combo.total > 40000 ? Math.round(combo.total * 0.8) : combo.total;
        return { ...combo, totalOriginal: combo.total, total: discountedTotal, discountApplied: combo.total > 40000 };
      });

      const combosTotal = selected.reduce((sum, combo) => sum + combo.total, 0);
      const total = Number(order.asientosTotal) + combosTotal;

      $('#combo-total-line').classList.toggle('hidden', !selected.length);
      $('#combos-subtotal').textContent = money(combosTotal);
      $('#seat-subtotal').textContent = money(order.asientosTotal);
      $('#grand-total').textContent = money(total);

      return { selected, total };
    }

    options.addEventListener('change', updateTotal);
    $('#skip-candy').addEventListener('click', () => {
      $$('.combo-option input').forEach((input) => (input.checked = false));
      updateTotal();
    });

    updateTotal();

    $('#pay-order').addEventListener('click', () => {
      const { selected, total } = updateTotal();
      save(sessionStorage, 'ordenFinal', {
        ...order,
        combosSeleccionados: selected,
        granTotal: total
      });
      sessionStorage.removeItem('comboReturn');
      location.href = 'pago.html';
    });
  }

  function initPayment() {
    if (!requireLogin()) return;

    const order = safeRead(sessionStorage, 'ordenFinal');
    if (!order) {
      location.replace('index.html');
      return;
    }

    $('#payment-total').textContent = money(order.granTotal);

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
        location.href = 'ticket.html';
      }, 700);
    });
  }

  function initTicket() {
    if (!requireLogin()) return;

    const order = safeRead(sessionStorage, 'ordenFinal');
    if (!order) {
      location.replace('index.html');
      return;
    }

    $('#ticket-movie').textContent = movies[order.movie] || order.movie;
    $('#ticket-details').innerHTML = `
      <div class="ticket-detail"><span>FECHA Y HORARIO</span><strong>Tu función · ${order.horario}</strong></div>
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
              ${combo.discountApplied ? `<del>${money(combo.totalOriginal)}</del> <span class="discount-tag">20% OFF</span> ` : ''}
              ${money(combo.total)}
            </strong>
          </div>
        `
      )
      .join('');

    $('#ticket-total').textContent = money(order.granTotal);

    const qr = $('.qr-wrap img');
    qr.addEventListener('error', () => {
      qr.style.display = 'none';
      $('.qr-fallback').style.display = 'grid';
    });

    $('#back-home').addEventListener('click', () => {
      sessionStorage.removeItem('orden');
      sessionStorage.removeItem('ordenFinal');
      sessionStorage.removeItem('comboReturn');
      location.href = 'index.html';
    });
  }

  initHeader();
  const page = document.body.dataset.page;

  ({
    home: initHome,
    login: initLogin,
    candybar: initCandybar,
    seleccion: initSelection,
    resumen: initSummary,
    pago: initPayment,
    ticket: initTicket
  }[page] || (() => {}))();
})();
