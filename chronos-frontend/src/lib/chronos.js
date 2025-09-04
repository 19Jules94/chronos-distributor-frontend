// src/lib/chronos.js
// Port fiel de chronos.py (misma lógica y categorías)

// ============================ UTILIDADES DE FECHA ==========================
export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromYmd(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dt, n) {
  const c = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

export function getWeekdayName(weekday) {
  // 0=lunes..6=domingo (en JS Sunday=0; ya normalizamos a 0=lunes)
  return ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'][weekday];
}

// ============================ CONSTRUCCIÓN DE DÍAS =========================
export function collectDaysBetweenInclusive(start, end) {
  // start/end: {year, month, day}
  const a = new Date(start.year, start.month - 1, start.day);
  const b = new Date(end.year, end.month - 1, end.day);
  if (b < a) throw new Error('La fecha final es anterior a la inicial.');
  const out = [];
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const wdJS = d.getDay();           // 0=Dom..6=Sáb
    const weekday = (wdJS + 6) % 7;    // 0=Lun..6=Dom
    out.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      weekday,                        // 0..6 (lunes..domingo)
      weekday_name: getWeekdayName(weekday),
      iso: ymd(d),
    });
  }
  return out;
}

// =============================== FIESTAS ===================================
export function normalizeHolidaysToIso(list = []) {
  // Acepta strings 'YYYY-MM-DD' o objetos {iso} o {year,month,day}
  const setIso = new Set();
  if (!list) return setIso;
  for (const item of list) {
    if (typeof item === 'string') {
      setIso.add(item);
    } else if (item && typeof item === 'object') {
      if ('iso' in item) setIso.add(String(item.iso));
      else setIso.add(ymd(new Date(item.year, item.month - 1, item.day)));
    } else {
      throw new TypeError("Elemento de vacaciones no reconocido (usa dict o 'YYYY-MM-DD').");
    }
  }
  return setIso;
}

export function markNonLective(listDays, listHolidays) {
  const holidays = normalizeHolidaysToIso(listHolidays || []);
  return listDays.map(d => ({
    ...d,
    // No lectivo si sábado(5), domingo(6) o está en festivos
    no_lectivo: d.weekday === 5 || d.weekday === 6 || holidays.has(d.iso),
  }));
}

export function markGuard(listDaysMarked) {
  // Guardia si: el día siguiente es lectivo
  const byIso = new Map(listDaysMarked.map(d => [d.iso, d]));
  return listDaysMarked.map(day => {
    const nextIso = ymd(addDays(fromYmd(day.iso), 1));
    const next = byIso.get(nextIso);
    if (next) {
      if (!('no_lectivo' in next)) {
        throw new Error(`Falta la asignación de 'no_lectivo' en el día siguiente: ${nextIso}`);
      }
      return { ...day, guardia: next.no_lectivo === false };
    }
    // último día del rango
    return { ...day, guardia: false };
  });
}

// ========================= CONTEO Y DISTRIBUCIÓN ===========================
export function contCategory(listDaysGuard) {
  const out = [];

  // Lunes..jueves (noches) con guardia, y el propio día debe ser lectivo
  for (const [num, name] of [[0,'lunes'],[1,'martes'],[2,'miercoles'],[3,'jueves']]) {
    const cnt = listDaysGuard.reduce((acc, d) =>
      acc + ((d.weekday === num) && d.guardia === true && d.no_lectivo === false ? 1 : 0), 0);
    out.push({ day: name, cont_day: cnt });
  }

  // Viernes lectivo (turno de día)
  const cntVie = listDaysGuard.reduce((acc, d) =>
    acc + ((d.weekday === 4) && d.no_lectivo === false ? 1 : 0), 0);
  out.push({ day: 'viernes', cont_day: cntVie });

  // Domingo/Festivo (noche):
  // - fin de semana (sábado=5, domingo=6)
  // - o festivo (no_lectivo=true) distinto de viernes (weekday != 4)
  const cntDomFest = listDaysGuard.reduce((acc, d) =>
    acc + (
      d.guardia === true &&
      (
        (d.weekday === 5 || d.weekday === 6) ||
        (d.no_lectivo === true && d.weekday !== 4)
      ) ? 1 : 0
    ), 0);
  out.push({ day: 'domingo_festivo', cont_day: cntDomFest });

  // Sumar +1 a la categoría del primer día del rango (doble guardia)
  if (listDaysGuard.length > 0) {
    const firstName = getWeekdayName(listDaysGuard[0].weekday);
    const row = out.find(r => r.day === firstName);
    if (row) row.cont_day = (row.cont_day || 0) + 1;
  }

  return out;
}

export function distributionDays(categorias, N_EMP = 13) {
  const empleados = Array.from({ length: N_EMP }, (_, i) => ({ id_name: `E${i + 1}`, total_guardias: 0 }));
  let rot = 0;
  for (const item of categorias) {
    const dia = item.day;
    const cantidad = Number(item.cont_day) || 0;
    const base = Math.floor(cantidad / N_EMP);
    const extra = cantidad % N_EMP;

    // base a todos
    for (const emp of empleados) {
      emp[dia] = (emp[dia] || 0) + base;
      emp.total_guardias += base;
    }

    // extras a quienes menos total llevan (con rotación para desempates)
    const indices = [...empleados.keys()];
    indices.sort((i, j) => {
      const di = empleados[i].total_guardias - empleados[j].total_guardias;
      if (di !== 0) return di;
      const ti = (i - rot + N_EMP) % N_EMP;
      const tj = (j - rot + N_EMP) % N_EMP;
      return ti - tj;
    });

    for (const i of indices.slice(0, extra)) {
      empleados[i][dia] = (empleados[i][dia] || 0) + 1;
      empleados[i].total_guardias += 1;
    }

    rot = (rot + 1) % N_EMP;
  }
  return empleados;
}

// ============================ RNG (semilla opcional) =======================
// Determinista y rápido. Si necesitas paridad *exacta* con Python random.Random,
// podemos cambiar a Mersenne Twister seed-compatible.
function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  if (seed === undefined || seed === null) return Math.random;
  const s = typeof seed === 'number'
    ? seed
    : Array.from(String(seed)).reduce((a, c) => a + c.charCodeAt(0), 0);
  return mulberry32(s >>> 0);
}
function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================ ASIGNACIÓN DETALLADA =========================
export function assignTurn(listDaysGuard, listAsignacion, seed = null) {
  const rng = makeRng(seed);

  // Copia y orden cronológico
  const dias = listDaysGuard.map(d => ({ ...d }));
  dias.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));

  // Estado por empleado
  const empleados = new Map();
  const ids = [];
  for (const e of listAsignacion) {
    const emp_id = e.id_name;
    ids.push(emp_id);
    empleados.set(emp_id, {
      resto: {
        lunes: e.lunes || 0,
        martes: e.martes || 0,
        miercoles: e.miercoles || 0,
        jueves: e.jueves || 0,
        domingo_festivo: e.domingo_festivo || 0,
      },
      total_noches: 0,
      ultima_noche_iso: null,
      viernes_asignados: 0,
    });
  }

  function categoriaNoche(d) {
    // Igual que en Python (FIX: sábado y domingo también)
    if (d.no_lectivo === true || d.weekday === 5 || d.weekday === 6) return 'domingo_festivo';
    return ['lunes','martes','miercoles','jueves'][d.weekday]; // 0..3
  }

  function diasEntre(a, b) {
    if (!a || !b) return 9999;
    const diff = Math.abs((fromYmd(b) - fromYmd(a)) / (24 * 3600 * 1000));
    return diff;
  }

  // Localiza el primer día con guardia para doble turno esa noche
  const firstGuardIso = (dias.find(d => d.guardia === true) || {}).iso || null;

  // PASADA ÚNICA
  for (const d of dias) {
    const hoy_iso = d.iso;

    // --- NOCHES ---
    if (d.guardia === true) {
      const cat = categoriaNoche(d);
      const slots = firstGuardIso && hoy_iso === firstGuardIso ? 2 : 1;

      d.empleados = [];
      const usados = new Set();

      for (let s = 0; s < slots; s++) {
        // candidatos: resto>0, descanso>=2, no repetido en la misma noche
        let candidatos = ids.filter(cid => {
          const e = empleados.get(cid);
          return (e.resto[cat] > 0) && (diasEntre(e.ultima_noche_iso, hoy_iso) >= 2) && !usados.has(cid);
        });

        if (candidatos.length === 0) {
          throw new Error(`No hay candidatos para ${hoy_iso} (${cat}) respetando descanso/cupos`);
        }

        // desempate: shuffle + ordenar por (-resto[cat], total_noches)
        shuffleInPlace(candidatos, rng);
        candidatos.sort((a, b) => {
          const ea = empleados.get(a), eb = empleados.get(b);
          const ra = ea.resto[cat], rb = eb.resto[cat];
          if (rb !== ra) return rb - ra; // más cuota pendiente primero
          return ea.total_noches - eb.total_noches; // menos noches totales primero
        });

        const elegido = candidatos[0];

        d.empleados.push(elegido);
        usados.add(elegido);
        const e = empleados.get(elegido);
        e.resto[cat] -= 1;
        e.total_noches += 1;
        e.ultima_noche_iso = hoy_iso;
      }

      // compat
      d.empleado = d.empleados[0];
      if (d.empleados.length > 1) d.empleado_extra = d.empleados[1];
    }

    // --- VIERNES LECTIVO (día) ---
    if (d.weekday === 4 && d.no_lectivo === false) {
      const ayer_iso = ymd(addDays(fromYmd(hoy_iso), -1));
      let candidatos = ids.filter(cid => empleados.get(cid).ultima_noche_iso !== ayer_iso);
      if (candidatos.length === 0) candidatos = [...ids]; // relajación opcional

      shuffleInPlace(candidatos, rng);
      candidatos.sort((a, b) =>
        empleados.get(a).viernes_asignados - empleados.get(b).viernes_asignados
      );

      const elegido = candidatos[0];
      if (!Array.isArray(d.empleados)) d.empleados = [];
      d.empleados.push(elegido);
      d.empleado = d.empleados[0]; // compat
      empleados.get(elegido).viernes_asignados += 1;
    }
  }

  return dias;
}

// ======================= EVENTOS (para FullCalendar) ======================
function empToTurnoNum(empId) {
  const m = String(empId).match(/^E(\d+)$/);
  return m ? Number(m[1]) : null;
}

export function buildEventsFromAssignments(dias) {
  const out = [];
  for (const d of dias) {
    // Noche
    if (d.guardia === true && Array.isArray(d.empleados) && d.empleados.length) {
      const nums = d.empleados.map(empToTurnoNum).filter(Boolean);
      out.push({
        id: `turno-noche-${d.iso}`,
        title: nums.length > 1 ? `Tnos ${nums.join(', ')}` : `T ${nums[0]}`,
        start: d.iso,
        allDay: true,
        extendedProps: { tipo: 'turno-noche', empleados: d.empleados, numeros: nums },
      });
    }
    // Viernes (día)
    if (d.weekday === 4 && d.no_lectivo === false) {
      const diaOnly = d.empleados?.filter(e => e)?.slice(-1)[0]; // el último añadido es el del viernes día
      if (diaOnly) {
        const n = empToTurnoNum(diaOnly);
        out.push({
          id: `turno-viernes-${d.iso}`,
          title: `V(día):T ${n}`,
          start: d.iso,
          allDay: true,
          extendedProps: { tipo: 'turno-viernes', empleado: diaOnly, numero: n },
        });
      }
    }
  }
  return out;
}

// ======================= RECUENTO (como contar_turnos) =====================
function empleadosDelDia(d) {
  if (Array.isArray(d.empleados) && d.empleados.length) return [...d.empleados];
  const res = [];
  if (d.empleado) res.push(d.empleado);
  if (d.empleado_extra) res.push(d.empleado_extra);
  return res;
}

function categoriaNocheRecuento(d) {
  const wd = d.weekday; // 0=lu..6=do
  if (d.no_lectivo === true || wd === 5 || wd === 6) return 'domingo_festivo';
  return ['lunes','martes','miercoles','jueves'][wd]; // 0..3
}

export function contarTurnos(dias) {
  const CATS = ['lunes','martes','miercoles','jueves','viernes','domingo_festivo'];
  const counts = {};

  function ensure(emp) {
    if (!counts[emp]) {
      counts[emp] = { id_name: emp };
      for (const c of CATS) counts[emp][c] = 0;
    }
  }

  for (const d of [...dias].sort((a,b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))) {
    const emps = empleadosDelDia(d);
    if (!emps || emps.length === 0) continue;

    // Viernes (día)
    if (d.weekday === 4) {
      for (const emp of emps) {
        ensure(emp);
        counts[emp].viernes += 1;
      }
    }

    // Noches (guardia)
    if (d.guardia === true) {
      const cat = categoriaNocheRecuento(d);
      for (const emp of emps) {
        ensure(emp);
        counts[emp][cat] += 1;
      }
    }
  }

  const out = [];
  for (const emp of Object.keys(counts)) {
    const row = counts[emp];
    const total = CATS.reduce((acc, c) => acc + (row[c] || 0), 0);
    out.push({ ...row, total });
  }
  out.sort((a,b) => parseInt(a.id_name.slice(1)) - parseInt(b.id_name.slice(1)));
  return out;
}

// ======================= PAYLOAD para backend ==============================
export function buildBulkPayloadFromAssignments(dias) {
  const out = [];
  for (const d of dias) {
    const iso = d.iso;
    if (d.guardia === true && Array.isArray(d.empleados)) {
      for (const emp of d.empleados) {
        const n = empToTurnoNum(emp);
        if (n) out.push({ fecha: iso, turnoAsignado: n });
      }
    }
    // viernes (día) ya va en d.empleados como último añadido; si quisieras
    // enviar también viernes como slot de día, puedes tratarlo aparte.
  }
  // deduplicar exactos
  const seen = new Set();
  const uniq = [];
  for (const r of out) {
    const key = `${r.fecha}#${r.turnoAsignado}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(r); }
  }
  return uniq;
}

// ============================== API ALTO NIVEL ============================
/**
 * Flujo Python:
 *  1) collectDaysBetweenInclusive
 *  2) markNonLective
 *  3) markGuard
 *  4) contCategory (+1 en el primer día)
 *  5) distributionDays
 *  6) assignTurn
 */
export function generateSchedule({ startISO, endISOExclusive, holidays = [], N_EMP = 13, seed = 42 }) {
  // Construimos [start, endExclusive-1]
  const start = fromYmd(startISO);
  const end = addDays(fromYmd(endISOExclusive), -1);

  const list = collectDaysBetweenInclusive(
    { year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate() },
    { year: end.getFullYear(), month: end.getMonth() + 1, day: end.getDate() }
  );
  const marked = markNonLective(list, holidays);
  const guard = markGuard(marked);
  const cats = contCategory(guard);
  const dist = distributionDays(cats, N_EMP);
  const asign = assignTurn(guard, dist, seed);
  const events = buildEventsFromAssignments(asign);
  return { dias: asign, events, categorias: cats, distribucion: dist };
}
