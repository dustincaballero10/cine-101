(() => {
  'use strict';

  // Configuración general
  const CFG = {
    descSedeDia: 0.2,
    descPrearmado: 0.1,
    descPersonalizado: 0.2,
    umbralPersonalizado: 25000,
    tarifas: { '2D': 7500, '3D': 10000, '4D 2D': 14000, '4D 3D': 18000 },
    maxEntradas: 6,
    maxPorProducto: 6,
    maxArticulosCombo: 12,
    maxCombosGlobal: 5,
    pesosPorPunto: 100,
    valorPunto: 1,
    horasLimite: 2,
    recargoCambio: 0.25,
    edadMin4D: 7
  };

  // Datos: películas, cines y productos
  const PELICULAS = {
    sexo: { nombre: 'Sexo: La película', clasif: 'SAM 18' },
    wicked: { nombre: 'Wicked', clasif: 'ATP' },
    redone: { nombre: 'Red One', clasif: 'SAM 13' },
    smile2: { nombre: 'Smile 2', clasif: 'SAM 16' },
    sonrie: { nombre: 'Sonríe', clasif: 'SAM 13' }
  };
  const EDAD_CLASIF = { 'ATP': 0, 'SAM 13': 13, 'SAM 16': 16, 'SAM 18': 18 };

  const CINES = [
    { name: 'Cine 101 Palermo', address: 'Av. Santa Fe 3253, Palermo, CABA' },
    { name: 'Cine 101 Recoleta', address: 'Av. Callao 1750, Recoleta, CABA' },
    { name: 'Cine 101 Belgrano', address: 'Av. Cabildo 2280, Belgrano, CABA' }
  ];
  const HORARIOS = ['14:30', '17:15', '20:00', '22:45'];

  const PRODUCTOS = [
    { name: 'Pochoclo chico', price: 1200, icon: '✳' },
    { name: 'Pochoclo grande', price: 1800, icon: '✴' },
    { name: 'Gaseosa 500ml', price: 900, icon: '◒' },
    { name: 'Agua mineral', price: 700, icon: '◉' },
    { name: 'Nachos con queso', price: 1800, icon: '⌁' },
    { name: 'Chocolate/Golosina', price: 1000, icon: '▰' }
  ];
  const item = (nombre, cantidad) => {
    const p = PRODUCTOS.find((x) => x.name === nombre);
    return { producto: nombre, cantidad, precioUnitario: p.price, subtotal: p.price * cantidad };
  };
  const PREARMADOS = [
    { id: 'pre-clasico', tipo: 'prearmado', nombre: 'Combo Clásico', items: [item('Pochoclo grande', 1), item('Gaseosa 500ml', 1)] },
    { id: 'pre-pareja', tipo: 'prearmado', nombre: 'Combo Pareja', items: [item('Pochoclo grande', 1), item('Gaseosa 500ml', 2), item('Nachos con queso', 1)] },
    { id: 'pre-familiar', tipo: 'prearmado', nombre: 'Combo Familiar', items: [item('Pochoclo grande', 2), item('Gaseosa 500ml', 4), item('Nachos con queso', 2), item('Chocolate/Golosina', 2)] }
  ];
  const COMBO_SIMPLE = { nombre: 'Combo simple', items: [item('Pochoclo chico', 1), item('Gaseosa 500ml', 1)] };

  // Fechas y horarios de función
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const proximosDias = (hoy = new Date()) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
      return { iso: aISO(d), dia: DIAS[d.getDay()], num: `${d.getDate()}/${d.getMonth() + 1}` };
    });
  const diaSemana = (iso) => new Date(`${iso}T00:00:00`).getDay();
  const inicioFuncion = (iso, hora) => new Date(`${iso}T${hora}:00`);

  // Regla 1: descuento por sede y día
  const descuentoSedeDia = (cine, iso) => {
    const d = diaSemana(iso);
    if (/Recoleta|Palermo/.test(cine) && (d === 3 || d === 4)) return CFG.descSedeDia;
    if (/Belgrano/.test(cine) && (d === 5 || d === 1)) return CFG.descSedeDia;
    return 0;
  };

  // Regla 3: tarifa por formato y precio de entradas
  const es4D = (formato) => formato.startsWith('4D');
  const precioEntradas = (formato, cantidad, cine, iso) => {
    const base = CFG.tarifas[formato] * cantidad;
    const pct = descuentoSedeDia(cine, iso);
    const desc = Math.round(base * pct);
    return { base, pct, desc, total: base - desc };
  };

  // Regla 2: precio de combos (prearmado 10%, personalizado 20% sobre $25.000)
  const precioCombo = (combo) => {
    const lista = combo.items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0);
    const pct = combo.tipo === 'prearmado' ? CFG.descPrearmado : lista > CFG.umbralPersonalizado ? CFG.descPersonalizado : 0;
    const desc = Math.round(lista * pct);
    return { lista, pct, desc, total: lista - desc };
  };

  // Regla 8: topes por transacción
  const maxCombos = (butacas) => Math.min(CFG.maxCombosGlobal, Math.max(1, butacas - 1));

  // Regla 5: validación de edad por clasificación
  const edadDe = (nac, hoy = new Date()) => {
    const [y, m, d] = nac.split('-').map(Number);
    let e = hoy.getFullYear() - y;
    if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--;
    return e;
  };
  const validarEdad = (peliId, nac, hoy = new Date()) => {
    const minima = EDAD_CLASIF[PELICULAS[peliId].clasif];
    if (!nac) return { ok: false, minima, edad: null };
    const edad = edadDe(nac, hoy);
    return { ok: edad >= minima, minima, edad };
  };

  // Regla 6: semana de cumpleaños (lunes a domingo) y bonificación
  const lunesDe = (d) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x.getTime();
  };
  const esSemanaCumple = (nac, hoy = new Date()) => {
    if (!nac) return false;
    const [, m, d] = nac.split('-').map(Number);
    return lunesDe(new Date(hoy.getFullYear(), m - 1, d)) === lunesDe(hoy);
  };
  const bonificacionCumple = (user, hoy = new Date()) => {
    if (!user || user.invitado || !esSemanaCumple(user.nacimiento, hoy)) return null;
    if (user.cumpleCanjeado === hoy.getFullYear()) return null;
    const combo = COMBO_SIMPLE.items.reduce((s, i) => s + i.subtotal, 0);
    return { entrada3D: CFG.tarifas['3D'], combo, combo_items: COMBO_SIMPLE.items };
  };

  // Regla 7: puntos (ganar y canjear)
  const puntosGanados = (total) => Math.floor(total / CFG.pesosPorPunto);
  const puntosAplicables = (pedidos, saldo, totalPrevio) =>
    Math.max(0, Math.min(Math.floor(pedidos) || 0, saldo, Math.floor(totalPrevio / CFG.valorPunto)));

  // Regla 4: cancelar o cambiar hasta 2 horas antes
  const puedeModificar = (iso, hora, ahora = new Date()) =>
    inicioFuncion(iso, hora).getTime() - ahora.getTime() >= CFG.horasLimite * 3600 * 1000;

  // Regla 9: costo por cambio de función (25% del valor de las butacas)
  const costoCambio = (compra) => Math.round((compra.entradasTotal ?? CFG.tarifas[compra.formato] * compra.asientos.length) * CFG.recargoCambio);

  // Almacenamiento
  const leer = (clave, def) => {
    try {
      return JSON.parse(localStorage.getItem(clave)) ?? def;
    } catch {
      return def;
    }
  };
  const guardar = (clave, valor) => localStorage.setItem(clave, JSON.stringify(valor));

  // Cuentas: usuario demo, registro e inicio de sesión
  const DEMO = { nombre: 'gonza', apellido: 'admin', email: 'admin', password: '1234', nacimiento: `2000-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`, puntos: 10000, cumpleCanjeado: null };
  const usuarios = () => {
    const lista = leer('usuarios', []);
    const i = lista.findIndex((u) => u.email === DEMO.email);
    if (i < 0) lista.unshift({ ...DEMO });
    else lista[i].nacimiento = DEMO.nacimiento;
    guardar('usuarios', lista);
    return lista;
  };
  const registrar = (datos) => {
    const lista = usuarios();
    const email = datos.email.trim().toLowerCase();
    if (lista.some((u) => u.email === email)) return { ok: false, error: 'Ese email ya está registrado.' };
    lista.push({ nombre: datos.nombre.trim(), apellido: datos.apellido.trim(), email, password: datos.password, nacimiento: datos.nacimiento, puntos: 0, cumpleCanjeado: null });
    guardar('usuarios', lista);
    return { ok: true, email };
  };
  const iniciarSesion = (email, password) => {
    const u = usuarios().find((x) => x.email === email.trim().toLowerCase() && x.password === password);
    if (!u) return { ok: false, error: 'Email o contraseña incorrectos.' };
    if (u.email === DEMO.email) actualizarUsuario(u.email, { cumpleCanjeado: null });
    guardar('session', { loggedIn: true, email: u.email, nombre: u.nombre, apellido: u.apellido });
    return { ok: true };
  };
  const entrarInvitado = () => guardar('session', { loggedIn: true, invitado: true, nombre: 'Invitado', apellido: '' });
  const usuarioActual = () => {
    const s = leer('session', null);
    if (!s?.loggedIn) return null;
    if (s.invitado) return { invitado: true, nombre: 'Invitado', apellido: '' };
    return usuarios().find((u) => u.email === s.email) || null;
  };
  const actualizarUsuario = (email, cambios) => {
    const lista = usuarios().map((u) => (u.email === email ? { ...u, ...cambios } : u));
    guardar('usuarios', lista);
  };

  // Compras: registrar, listar y cancelar
  const comprasDe = (email) => leer('compras', []).filter((c) => c.email === email);
  const registrarCompra = (compra) => {
    const todas = leer('compras', []);
    todas.push({ ...compra, id: `CINE101-${Date.now().toString(36).toUpperCase()}`, estado: 'activa' });
    guardar('compras', todas);
    return todas[todas.length - 1];
  };
  const cancelarCompra = (id, ahora = new Date()) => {
    const todas = leer('compras', []);
    const c = todas.find((x) => x.id === id);
    if (!c || c.estado !== 'activa') return { ok: false, error: 'La compra no está activa.' };
    if (!puedeModificar(c.fecha, c.hora, ahora)) return { ok: false, error: 'Pasó el límite de 2 horas antes de la función.' };
    c.estado = 'cancelada';
    guardar('compras', todas);
    const u = usuarios().find((x) => x.email === c.email);
    if (u) actualizarUsuario(u.email, { puntos: Math.max(0, u.puntos + (c.puntosUsados || 0) - (c.puntosGanados || 0)) });
    return { ok: true, devueltos: c.puntosUsados || 0 };
  };

  window.Cine101 = {
    CFG, PELICULAS, CINES, HORARIOS, PRODUCTOS, PREARMADOS, COMBO_SIMPLE, DIAS,
    proximosDias, inicioFuncion, descuentoSedeDia, es4D, precioEntradas, precioCombo,
    maxCombos, edadDe, validarEdad, esSemanaCumple, bonificacionCumple,
    puntosGanados, puntosAplicables, puedeModificar, costoCambio,
    leer, guardar, usuarios, registrar, iniciarSesion, entrarInvitado, usuarioActual, actualizarUsuario,
    comprasDe, registrarCompra, cancelarCompra
  };
})();
