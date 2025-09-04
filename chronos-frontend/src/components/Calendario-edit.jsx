// src/components/Calendario-edit.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { Paper, Stack, Button, Typography, Menu, MenuItem, ListItemText } from '@mui/material';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';

import CursoEscolarPicker from './CursoEscolarPicker.jsx';
import { generateSchedule, addDays, fromYmd, ymd } from '../lib/chronos.js';

// ================== CONFIG API ==================
const API_BASE = 'https://localhost:7201/api';

const EnumTipoFestivo = ['Navidad', 'FestivoNacional', 'Carnavales', 'SemanaSanta', 'FestivoLectivo'];

// ---------- API helpers ----------
async function apiGetFestivosPorCurso(curso, apiBase = API_BASE) {
  if (!curso?.id) return [];
  const tryByCurso = async () => {
    const r1 = await fetch(`${apiBase}/Festivos/por_curso/${curso.id}`, { headers: { accept: '*/*' } });
    if (r1.ok) return JSON.parse((await r1.text()) || '[]');
    const r2 = await fetch(`${apiBase}/Festivos/por-curso/${curso.id}`, { headers: { accept: '*/*' } });
    if (r2.ok) return JSON.parse((await r2.text()) || '[]');
    return null;
  };
  const byCurso = await tryByCurso().catch(() => null);
  if (byCurso) return byCurso;
  const r = await fetch(`${apiBase}/Festivos`, { headers: { accept: '*/*' } });
  if (!r.ok) throw new Error(`Error al listar festivos (${r.status})`);
  const all = JSON.parse((await r.text()) || '[]');
  return all.filter(f => f.fecha >= curso.fechaInicio && f.fecha <= curso.fechaFin);
}

async function apiGetCursosEscolar() {
  const res = await fetch(`${API_BASE}/CursoEscolar`, { headers: { accept: '*/*' } });
  if (!res.ok) throw new Error(`Error al listar cursos (${res.status})`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function apiCrearCursoEscolar({ fechaInicio, fechaFin }) {
  const res = await fetch(`${API_BASE}/CursoEscolar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify({ fechaInicio, fechaFin }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Error al crear curso (${res.status}) ${msg}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : { fechaInicio, fechaFin };
}

async function apiTurnosPorCursoConNombres(cursoId) {
  let res = await fetch(`${API_BASE}/Turnos/por_curso/${cursoId}`, { headers: { accept: '*/*' } });
  if (res.status === 404) {
    res = await fetch(`${API_BASE}/Turnos/por-curso/${cursoId}`, { headers: { accept: '*/*' } });
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Error al cargar turnos del curso (${res.status}) ${msg}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function apiCrearFestivoDia({ fecha, tipoFestivo }) {
  const res = await fetch(`${API_BASE}/Festivos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify({ fecha, tipoFestivo }),
  });
  if (!res.ok) throw new Error(`Error al crear festivo (día) (${res.status})`);
  const text = await res.text();
  return text ? JSON.parse(text) : { fecha, tipoFestivo };
}

async function apiCrearFestivosRango(payloadArray) {
  const res = await fetch(`${API_BASE}/Festivos/crear_festivos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payloadArray),
  });
  if (!res.ok) throw new Error(`Error al crear festivos (rango) (${res.status})`);
  const text = await res.text();
  return text ? JSON.parse(text) : payloadArray;
}

async function apiEliminarFestivoPorFecha(fecha) {
  const res = await fetch(`${API_BASE}/Festivos/${fecha}`, { method: 'DELETE', headers: { accept: '*/*' } });
  if (!res.ok) throw new Error(`Error al eliminar festivo por fecha (${res.status})`);
}

async function apiEliminarFestivosPorRangoFechas(fechasYYYYMMDD) {
  const res = await fetch(`${API_BASE}/Festivos`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(fechasYYYYMMDD),
  });
  if (!res.ok) throw new Error(`Error al eliminar festivos por rango (${res.status})`);
}

// ================== UTILS ==================
const fmtDateOnly = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const dateFromYMD = ymdStr => {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};
function* daysBetween(startISO, endISO) {
  const d = dateFromYMD(startISO.slice(0, 10));
  const end = dateFromYMD(endISO.slice(0, 10));
  while (d < end) {
    yield fmtDateOnly(d);
    d.setDate(d.getDate() + 1);
  }
}
function festivoToEvents(f) {
  const id = String(`${f.fecha}-${f.tipoFestivo}`);
  return [
    { id: `bg-${id}`, start: f.fecha, allDay: true, display: 'background', backgroundColor: 'rgba(244,67,54,0.35)' },
    { id, title: `Festivo: ${f.tipoFestivo}`, start: f.fecha, allDay: true },
  ];
}

// --- helpers de nombres ---
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Solo nombre (sin apellidos / emails)
function onlyNombre(full) {
  if (!full) return null;
  let trimmed = String(full).trim();
  const at = trimmed.indexOf('@');
  if (at > 0) trimmed = trimmed.slice(0, at);
  trimmed = trimmed.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  const token = trimmed.split(/[ \t._-]+/)[0];
  return cap(token.toLowerCase());
}

// Encuentra el campo de nombre en distintos esquemas de la API
function pickNombreUsuario(t) {
  const get = v => (typeof v === 'string' ? v.trim() : '');
  const nested = [
    t?.usuario?.nombre, t?.usuario?.Nombre, t?.usuario?.UserName, t?.usuario?.username, t?.usuario?.Email,
    t?.Usuario?.nombre, t?.Usuario?.Nombre, t?.Usuario?.UserName, t?.Usuario?.username, t?.Usuario?.Email,
  ];
  const flat = [
    t?.nombreUsuario, t?.NombreUsuario, t?.usuarioNombre, t?.UsuarioNombre,
    t?.nombre, t?.Nombre, t?.userName, t?.username, t?.UserName,
    t?.email, t?.Email, t?.correo, t?.Correo,
  ];
  const cand = [...flat, ...nested].map(get).find(s => s && s.length > 0);
  return cand || null;
}

// Construir eventos de turnos desde servidor (usa nombre si hay)
// *** ID ÚNICO: fecha+turno+usuario ***
function buildEventsFromServerTurnos(list) {
  return list.map((t, idx) => {
    const fecha = t.fecha ?? t.Fecha;
    const turno = t.turnoAsignado ?? t.TurnoAsignado;
    const usuarioId = t.usuarioId ?? t.UsuarioId ?? t.userId ?? t.UserId ?? t?.usuario?.id ?? t?.Usuario?.Id ?? null;

    const nombreRaw = pickNombreUsuario(t);
    const titulo = nombreRaw ? onlyNombre(nombreRaw) : `T ${turno}`;

    if (!nombreRaw) {
      console.warn('[Calendario] Sin nombre para turno', { fecha, turno, usuarioId, record: t });
    }

    const unique = usuarioId ?? `idx${idx}`;
    return {
      id: `turno-${fecha}-${turno}-${unique}`,
      title: titulo,
      start: fecha,
      allDay: true,
      extendedProps: { tipo: 'turno-db', turnoAsignado: turno, usuarioId, nombreUsuario: titulo },
    };
  });
}

// Desde 'dias' generados → payload turnos
const empIdToNum = empId => {
  const m = String(empId).match(/^E(\d+)$/);
  return m ? Number(m[1]) : null;
};
function diasToTurnosPayload(dias) {
  const out = [];
  for (const d of dias || []) {
    if (Array.isArray(d.empleados) && d.empleados.length) {
      const nums = d.empleados.map(empIdToNum).filter(Boolean);
      for (const n of nums) out.push({ fecha: d.iso, turnoAsignado: n });
    }
  }
  const seen = new Set();
  return out.filter(r => {
    const key = `${r.fecha}#${r.turnoAsignado}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Selecciona curso “actual”
function pickCursoActual(cursos) {
  const today = fmtDateOnly(new Date());
  const cont = cursos.find(c => today >= c.fechaInicio && today <= c.fechaFin);
  if (cont) return cont;
  const pasados = cursos.filter(c => c.fechaInicio <= today);
  if (pasados.length > 0) {
    pasados.sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : -1));
    return pasados[0];
  }
  const futuros = cursos.filter(c => c.fechaInicio > today);
  futuros.sort((a, b) => (a.fechaInicio < b.fechaInicio ? -1 : 1));
  return futuros[0] || null;
}

// ================== COMPONENTE ==================
export default function CalenFestivos() {
  const calendarRef = useRef(null);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [festivosSet, setFestivosSet] = useState(new Set());
  const [cursos, setCursos] = useState([]);
  const [cursoActual, setCursoActual] = useState(null);

  const lastDiasRef = useRef(null);

  // Menús
  const [dayMenu, setDayMenu] = useState(null);
  const [eventMenu, setEventMenu] = useState(null);

  // Selección (rango)
  const [selectedRange, setSelectedRange] = useState(null);

  // Submenús
  const [activeTopDay, setActiveTopDay] = useState(null);
  const [addAnchorEl, setAddAnchorEl] = useState(null);
  const [deleteAnchorEl, setDeleteAnchorEl] = useState(null);
  const [editAnchorEl, setEditAnchorEl] = useState(null);
  const [activeAddSub, setActiveAddSub] = useState(null);
  const [addSingleAnchorEl, setAddSingleAnchorEl] = useState(null);
  const [addRangeAnchorEl, setAddRangeAnchorEl] = useState(null);

  const [activeTopEvent, setActiveTopEvent] = useState(null);
  const [evAddAnchorEl, setEvAddAnchorEl] = useState(null);
  const [evDeleteAnchorEl, setEvDeleteAnchorEl] = useState(null);
  const [evEditAnchorEl, setEvEditAnchorEl] = useState(null);
  const [activeEvAddSub, setActiveEvAddSub] = useState(null);
  const [evAddSingleAnchorEl, setEvAddSingleAnchorEl] = useState(null);
  const [evAddRangeAnchorEl, setEvAddRangeAnchorEl] = useState(null);

  const loadFestivosPorCurso = useCallback(async (curso) => {
    if (!curso?.id) {
      setFestivosSet(new Set());
      setEvents(prev => prev.filter(e =>
        e?.extendedProps?.tipo === 'turno-db' ||
        e?.extendedProps?.tipo === 'turno-noche' ||
        e?.extendedProps?.tipo === 'turno-viernes'
      ));
      return;
    }
    setLoading(true);
    try {
      const data = await apiGetFestivosPorCurso(curso);
      setFestivosSet(new Set(data.map(f => f.fecha)));
      setEvents(prev => {
        const soloTurnos = prev.filter(
          e => e?.extendedProps?.tipo === 'turno-db' ||
               e?.extendedProps?.tipo === 'turno-noche' ||
               e?.extendedProps?.tipo === 'turno-viernes'
        );
        return [...data.flatMap(festivoToEvents), ...soloTurnos];
      });
    } catch (e) {
      console.error('Error cargando festivos:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTurnosFromServer = useCallback(async (forcedCursoId) => {
    const cid = forcedCursoId ?? cursoActual?.id;
    if (!cid) return;
    try {
      const list = await apiTurnosPorCursoConNombres(cid);
      const turnosEvents = buildEventsFromServerTurnos(list);
      setEvents(prev => {
        const soloFestivos = prev.filter(
          e => e.display === 'background' || (typeof e.title === 'string' && e.title.startsWith('Festivo:'))
        );
        return [...soloFestivos, ...turnosEvents];
      });
      lastDiasRef.current = null;
    } catch (e) {
      console.error('Error refrescando turnos desde BD:', e);
      alert(`No se pudieron cargar los turnos del servidor: ${e.message}`);
    }
  }, [cursoActual?.id]);

  const generarHorarioPythonLike = useCallback(() => {
    if (!cursoActual) {
      alert('No hay curso escolar seleccionado/cargado.');
      return;
    }
    const startISO = cursoActual.fechaInicio;
    const endExcl = ymd(addDays(fromYmd(cursoActual.fechaFin), 1));
    const holidays = Array.from(festivosSet);

    const { dias, events: newEvents } = generateSchedule({
      startISO, endISOExclusive: endExcl, holidays, N_EMP: 13, seed: 42,
    });

    lastDiasRef.current = dias;

    setEvents(prev => {
      const prevSinTurnos = prev.filter(
        e => e?.extendedProps?.tipo !== 'turno-noche' &&
             e?.extendedProps?.tipo !== 'turno-viernes' &&
             e?.extendedProps?.tipo !== 'turno-db'
      );
      return [...prevSinTurnos, ...newEvents];
    });
  }, [cursoActual, festivosSet]);

  const guardarHorario = useCallback(async () => {
    try {
      let dias = lastDiasRef.current;
      if (!dias) {
        if (!cursoActual) { alert('Primero genera el horario.'); return; }
        const startISO = cursoActual.fechaInicio;
        const endExcl = ymd(addDays(fromYmd(cursoActual.fechaFin), 1));
        const holidays = Array.from(festivosSet);
        const gen = generateSchedule({ startISO, endISOExclusive: endExcl, holidays, N_EMP: 13, seed: 42 });
        dias = gen.dias;
        lastDiasRef.current = dias;
      }
      const payload = diasToTurnosPayload(dias);
      if (payload.length === 0) { alert('No hay turnos que guardar.'); return; }

      await apiCrearTurnos(payload);
      alert(`Horario guardado (${payload.length} turnos).`);
      await refreshTurnosFromServer();
    } catch (e) {
      console.error('Error guardando horario:', e);
      alert(`Error guardando horario: ${e.message}`);
    }
  }, [cursoActual, festivosSet, refreshTurnosFromServer]);

  // Estilo FullCalendar
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--fc-border-color', '#eee');
    root.style.setProperty('--fc-event-text-color', '#fff');
  }, []);

  // Carga cursos
  const loadCursos = useCallback(async () => {
    try {
      const data = await apiGetCursosEscolar();
      setCursos(data);
      setCursoActual(pickCursoActual(data) || null);
    } catch (e) {
      console.error('Error cargando cursos:', e);
    }
  }, []);
  useEffect(() => { loadCursos(); }, [loadCursos]);

  // Cambio de curso
  useEffect(() => {
    if (!cursoActual?.id) return;
    const api = calendarRef.current?.getApi?.();
    if (api && cursoActual?.fechaInicio) api.gotoDate(dateFromYMD(cursoActual.fechaInicio));

    setEvents([]);
    setFestivosSet(new Set());
    lastDiasRef.current = null;

    (async () => {
      await loadFestivosPorCurso(cursoActual);
      await refreshTurnosFromServer(cursoActual.id);
    })();
  }, [cursoActual?.id, cursoActual?.fechaInicio, loadFestivosPorCurso, refreshTurnosFromServer]);

  // Context menus
  const dayCellDidMount = useCallback((info) => {
    info.el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      setDayMenu({ mouseX: e.clientX + 2, mouseY: e.clientY - 6, date: info.date });
      setEventMenu(null);
      setActiveTopEvent(null);
      setEvAddAnchorEl(null);
      setEvDeleteAnchorEl(null);
      setEvEditAnchorEl(null);
      setActiveEvAddSub(null);
      setEvAddSingleAnchorEl(null);
      setEvAddRangeAnchorEl(null);
    });
  }, []);
  const eventDidMount = useCallback((info) => {
    info.el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      setEventMenu({ mouseX: e.clientX + 2, mouseY: e.clientY - 6, event: info.event });
      setDayMenu(null);
      setActiveTopDay(null);
      setAddAnchorEl(null);
      setDeleteAnchorEl(null);
      setEditAnchorEl(null);
      setActiveAddSub(null);
      setAddSingleAnchorEl(null);
      setAddRangeAnchorEl(null);
    });
  }, []);

  // Selección
  const handleSelect = useCallback((info) => {
    setSelectedRange({ start: info.startStr, end: info.endStr, allDay: info.allDay });
  }, []);
  const clearSelection = () => {
    const api = calendarRef.current?.getApi();
    api?.unselect();
    setSelectedRange(null);
  };

  // ====== CREAR / ELIMINAR FESTIVOS ======
  const fechaPerteneceAlCurso = (dateISO, curso) => !!curso && dateISO >= curso.fechaInicio && dateISO <= curso.fechaFin;

  const crearUnFestivoEnDia = useCallback(async (tipoFestivo) => {
    try {
      if (!dayMenu?.date) return;
      const fecha = fmtDateOnly(dayMenu.date);
      if (!fechaPerteneceAlCurso(fecha, cursoActual)) { alert(`La fecha ${fecha} no pertenece al curso seleccionado.`); return; }
      await apiCrearFestivoDia({ fecha, tipoFestivo });
      await loadFestivosPorCurso(cursoActual);
    } catch (e) {
      console.error('Error creando festivo (día):', e);
    }
    setDayMenu(null);
    setActiveTopDay(null);
    setAddAnchorEl(null);
    setDeleteAnchorEl(null);
    setEditAnchorEl(null);
    setActiveAddSub(null);
    setAddSingleAnchorEl(null);
    setAddRangeAnchorEl(null);
  }, [dayMenu, cursoActual, loadFestivosPorCurso]);

  const crearRango = useCallback(async (tipoFestivo) => {
    try {
      if (!selectedRange || !cursoActual) return;
      const fechas = Array.from(daysBetween(selectedRange.start, selectedRange.end));
      const fuera = fechas.find(f => !fechaPerteneceAlCurso(f, cursoActual));
      if (fuera) { alert(`La fecha ${fuera} está fuera del curso seleccionado.`); return; }
      const payload = fechas.map(fecha => ({ fecha, tipoFestivo }));
      await apiCrearFestivosRango(payload);
      await loadFestivosPorCurso(cursoActual);
    } catch (e) {
      console.error('Error creando festivos (rango):', e);
    }
    clearSelection();
    setDayMenu(null);
  }, [selectedRange, cursoActual, loadFestivosPorCurso]);

  const eliminarFestivoActualPorFecha = useCallback(async () => {
    const ev = eventMenu?.event;
    const dateISO = ev?.startStr?.slice(0, 10) || (ev?.start instanceof Date ? fmtDateOnly(ev.start) : null);
    if (!dateISO) return;
    try {
      await apiEliminarFestivoPorFecha(dateISO);
      await loadFestivosPorCurso(cursoActual);
    } catch (e) {
      console.error('Error eliminando por fecha:', e);
    }
    setEventMenu(null);
  }, [eventMenu, cursoActual, loadFestivosPorCurso]);

  const eliminarTodosDelDia = useCallback(async () => {
    const dateISO =
      eventMenu?.event?.startStr?.slice(0, 10) ||
      (eventMenu?.event?.start instanceof Date ? fmtDateOnly(eventMenu.event.start) : null) ||
      (dayMenu?.date ? fmtDateOnly(dayMenu.date) : null);
    if (!dateISO) return;
    try {
      await apiEliminarFestivoPorFecha(dateISO);
      await loadFestivosPorCurso(cursoActual);
    } catch (e) {
      console.error('Error eliminando por fecha:', e);
    }
    setDayMenu(null);
    setEventMenu(null);
    setActiveTopDay(null);
    setDeleteAnchorEl(null);
  }, [dayMenu, eventMenu, cursoActual, loadFestivosPorCurso]);

  const eliminarRangoSeleccionado = useCallback(async () => {
    if (!selectedRange) return;
    try {
      const fechas = Array.from(daysBetween(selectedRange.start, selectedRange.end));
      if (fechas.length === 0) return;
      await apiEliminarFestivosPorRangoFechas(fechas);
      await loadFestivosPorCurso(cursoActual);
    } catch (e) {
      console.error('Error eliminando festivos (rango):', e);
    }
    clearSelection();
    setDayMenu(null);
    setActiveTopDay(null);
    setDeleteAnchorEl(null);
  }, [selectedRange, cursoActual, loadFestivosPorCurso]);

  // EDITAR (solo título local)
  const editarEventoActualTipo = useCallback((nuevoTipo) => {
    const ev = eventMenu?.event;
    if (!ev) return;
    const id = ev.id;
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, title: `Festivo: ${nuevoTipo}` } : e)));
    setEventMenu(null);
  }, [eventMenu]);

  const hasTurnos = useMemo(
    () => events.some(e => ['turno-noche', 'turno-viernes'].includes(e?.extendedProps?.tipo)),
    [events]
  );

  const rangeLabel = useMemo(() => {
    if (!selectedRange) return '';
    return `${selectedRange.start} → ${selectedRange.end} (excl.)`;
  }, [selectedRange]);

  const initialDate = useMemo(() => {
    if (cursoActual?.fechaInicio) return dateFromYMD(cursoActual.fechaInicio);
    const today = new Date();
    const year = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
    return new Date(year, 8, 1);
  }, [cursoActual]);

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {cursoActual ? `Curso ${cursoActual.fechaInicio} → ${cursoActual.fechaFin}` : 'Curso escolar'}
          {loading ? ' · cargando…' : ''}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          <CursoEscolarPicker
            cursos={cursos}
            cursoActualId={cursoActual?.id ?? ''}
            onChangeCurso={async (idSel) => {
              const sel = cursos.find(c => c.id === idSel) || null;
              setCursoActual(sel);
              if (sel) {
                const api = calendarRef.current?.getApi?.();
                if (api && sel.fechaInicio) api.gotoDate(dateFromYMD(sel.fechaInicio));
                setEvents([]); setFestivosSet(new Set()); lastDiasRef.current = null;
                await loadFestivosPorCurso(sel);
                await refreshTurnosFromServer(sel.id);
              }
            }}
            onCreateCurso={async ({ fechaInicio, fechaFin }) => {
              try {
                const nuevo = await apiCrearCursoEscolar({ fechaInicio, fechaFin });
                setCursos(prev => [...prev, nuevo].sort((a,b) => (a.fechaInicio < b.fechaInicio ? 1 : -1)));
                setCursoActual(nuevo);
                const api = calendarRef.current?.getApi?.();
                if (api && nuevo.fechaInicio) api.gotoDate(dateFromYMD(nuevo.fechaInicio));
                setEvents([]); setFestivosSet(new Set()); lastDiasRef.current = null;
                await loadFestivosPorCurso(nuevo);
                await refreshTurnosFromServer(nuevo.id);
                return true;
              } catch (e) {
                console.error('Crear curso escolar:', e);
                alert(e.message);
                return false;
              }
            }}
          />

          {selectedRange && <Typography variant="body2">Rango: {rangeLabel}</Typography>}

          <Button variant="outlined" startIcon={<EventRepeatRoundedIcon />}
            onClick={() => cursoActual && refreshTurnosFromServer(cursoActual.id)}
            disabled={!cursoActual} title={!cursoActual ? 'Cargando curso escolar…' : undefined}>
            Cargar turnos (BD)
          </Button>

          <Button variant="contained" startIcon={<EventRepeatRoundedIcon />}
            onClick={generarHorarioPythonLike} disabled={!cursoActual}
            title={!cursoActual ? 'Cargando curso escolar…' : undefined}>
            Generar Horario
          </Button>

          <Button variant="contained" color="success" startIcon={<EventRepeatRoundedIcon />}
            onClick={guardarHorario} disabled={!hasTurnos && !lastDiasRef.current}>
            Guardar Horario
          </Button>
        </Stack>
      </Stack>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, multiMonthPlugin, interactionPlugin]}
        views={{ schoolYear: { type: 'multiMonth', duration: { months: 10 }, multiMonthMaxColumns: 3, multiMonthMinWidth: 380 } }}
        initialView="schoolYear"
        initialDate={initialDate}
        weekends
        locale={esLocale}
        timeZone="local"
        firstDay={1}
        selectable
        selectMirror
        unselectAuto={false}
        select={handleSelect}
        dayCellDidMount={dayCellDidMount}
        eventDidMount={eventDidMount}
        events={events}
        height="auto"
        dayMaxEvents={4}
        eventDisplay="block"
      />

      {/* ===== DÍA: top-level ===== */}
      <Menu
        open={!!dayMenu}
        onClose={() => { setDayMenu(null); setActiveTopDay(null); setAddAnchorEl(null); setDeleteAnchorEl(null); setEditAnchorEl(null); setActiveAddSub(null); setAddSingleAnchorEl(null); setAddRangeAnchorEl(null); }}
        anchorReference="anchorPosition"
        anchorPosition={dayMenu ? { top: dayMenu.mouseY, left: dayMenu.mouseX } : undefined}
        PaperProps={{ sx: { minWidth: 300 } }}
        transitionDuration={100}
      >
        <MenuItem onMouseEnter={(e) => { setActiveTopDay('add'); setActiveAddSub(null); setAddAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveTopDay('add'); setActiveAddSub(null); setAddAnchorEl(e.currentTarget); }}
                  selected={activeTopDay === 'add'}>
          <ListItemText primary="Añadir ▸" />
        </MenuItem>

        <MenuItem onMouseEnter={(e) => { setActiveTopDay('delete'); setDeleteAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveTopDay('delete'); setDeleteAnchorEl(e.currentTarget); }}
                  selected={activeTopDay === 'delete'}>
          <ListItemText primary="Eliminar ▸" />
        </MenuItem>

        <MenuItem onMouseEnter={(e) => { setActiveTopDay('edit'); setEditAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveTopDay('edit'); setEditAnchorEl(e.currentTarget); }}
                  selected={activeTopDay === 'edit'}
                  disabled>
          <ListItemText primary="Editar ▸" />
        </MenuItem>
      </Menu>

      {/* DÍA → Añadir (2º nivel) */}
      <Menu
        anchorEl={addAnchorEl}
        open={!!dayMenu && activeTopDay === 'add' && !!addAnchorEl}
        onClose={() => setActiveTopDay(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 260 } }}
        transitionDuration={100}
      >
        <MenuItem onMouseEnter={(e) => { setActiveAddSub('single'); setAddSingleAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveAddSub('single'); setAddSingleAnchorEl(e.currentTarget); }}
                  selected={activeAddSub === 'single'}>
          <ListItemText primary="Un festivo ▸" />
        </MenuItem>

        <MenuItem onMouseEnter={(e) => { setActiveAddSub('range'); setAddRangeAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveAddSub('range'); setAddRangeAnchorEl(e.currentTarget); }}
                  selected={activeAddSub === 'range'}
                  disabled={!selectedRange}>
          <ListItemText primary="Rango ▸" />
        </MenuItem>
      </Menu>

      {/* DÍA → Añadir → Un festivo (3º nivel) */}
      <Menu anchorEl={addSingleAnchorEl}
        open={!!dayMenu && activeTopDay === 'add' && activeAddSub === 'single' && !!addSingleAnchorEl}
        onClose={() => setActiveAddSub(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }} PaperProps={{ sx: { minWidth: 240 } }}
        transitionDuration={100}>
        {EnumTipoFestivo.map((tipo) => (
          <MenuItem key={`add-dia-${tipo}`} onClick={() => crearUnFestivoEnDia(tipo)}>{tipo}</MenuItem>
        ))}
      </Menu>

      {/* DÍA → Añadir → Rango (3º nivel) */}
      <Menu anchorEl={addRangeAnchorEl}
        open={!!dayMenu && activeTopDay === 'add' && activeAddSub === 'range' && !!addRangeAnchorEl}
        onClose={() => setActiveAddSub(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }} PaperProps={{ sx: { minWidth: 240 } }}
        transitionDuration={100}>
        {EnumTipoFestivo.map((tipo) => (
          <MenuItem key={`add-rango-${tipo}`} disabled={!selectedRange} onClick={() => crearRango(tipo)}>{tipo}</MenuItem>
        ))}
      </Menu>

      {/* *** DÍA → Eliminar (2º nivel) *** */}
      <Menu
        anchorEl={deleteAnchorEl}
        open={!!dayMenu && activeTopDay === 'delete' && !!deleteAnchorEl}
        onClose={() => setActiveTopDay(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 260 } }}
        transitionDuration={100}
      >
        <MenuItem onClick={eliminarTodosDelDia}>Eliminar todos los festivos del día</MenuItem>
        <MenuItem onClick={eliminarRangoSeleccionado} disabled={!selectedRange}>Eliminar rango seleccionado</MenuItem>
      </Menu>

      {/* ===== EVENTO: top-level ===== */}
      <Menu
        open={!!eventMenu}
        onClose={() => {
          setEventMenu(null);
          setActiveTopEvent(null);
          setEvAddAnchorEl(null);
          setEvDeleteAnchorEl(null);
          setEvEditAnchorEl(null);
          setActiveEvAddSub(null);
          setEvAddSingleAnchorEl(null);
          setEvAddRangeAnchorEl(null);
        }}
        anchorReference="anchorPosition"
        anchorPosition={eventMenu ? { top: eventMenu.mouseY, left: eventMenu.mouseX } : undefined}
        PaperProps={{ sx: { minWidth: 300 } }}
        transitionDuration={100}
      >
        <MenuItem onMouseEnter={(e) => { setActiveTopEvent('add'); setActiveEvAddSub(null); setEvAddAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveTopEvent('add'); setActiveEvAddSub(null); setEvAddAnchorEl(e.currentTarget); }}
                  selected={activeTopEvent === 'add'}>
          <ListItemText primary="Añadir ▸" />
        </MenuItem>

        <MenuItem onMouseEnter={(e) => { setActiveTopEvent('delete'); setEvDeleteAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveTopEvent('delete'); setEvDeleteAnchorEl(e.currentTarget); }}
                  selected={activeTopEvent === 'delete'}>
          <ListItemText primary="Eliminar ▸" />
        </MenuItem>

        <MenuItem onMouseEnter={(e) => { setActiveTopEvent('edit'); setEvEditAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveTopEvent('edit'); setEvEditAnchorEl(e.currentTarget); }}
                  selected={activeTopEvent === 'edit'}>
          <ListItemText primary="Editar ▸" />
        </MenuItem>
      </Menu>

      {/* EVENTO → Añadir (2º nivel) */}
      <Menu anchorEl={evAddAnchorEl}
        open={!!eventMenu && activeTopEvent === 'add' && !!evAddAnchorEl}
        onClose={() => setActiveTopEvent(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }} PaperProps={{ sx: { minWidth: 260 } }}
        transitionDuration={100}>
        <MenuItem onMouseEnter={(e) => { setActiveEvAddSub('single'); setEvAddSingleAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveEvAddSub('single'); setEvAddSingleAnchorEl(e.currentTarget); }}
                  selected={activeEvAddSub === 'single'}>
          <ListItemText primary="Un festivo ▸" />
        </MenuItem>
        <MenuItem onMouseEnter={(e) => { setActiveEvAddSub('range'); setEvAddRangeAnchorEl(e.currentTarget); }}
                  onClick={(e) => { setActiveEvAddSub('range'); setEvAddRangeAnchorEl(e.currentTarget); }}
                  selected={activeEvAddSub === 'range'}
                  disabled={!selectedRange}>
          <ListItemText primary="Rango ▸" />
        </MenuItem>
      </Menu>

      {/* EVENTO → Añadir → Un festivo (3º nivel) */}
      <Menu anchorEl={evAddSingleAnchorEl}
        open={!!eventMenu && activeTopEvent === 'add' && activeEvAddSub === 'single' && !!evAddSingleAnchorEl}
        onClose={() => setActiveEvAddSub(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }} PaperProps={{ sx: { minWidth: 240 } }}
        transitionDuration={100}>
        {EnumTipoFestivo.map((tipo) => (
          <MenuItem key={`ev-add-dia-${tipo}`} onClick={() => crearUnFestivoEnDia(tipo)}>{tipo}</MenuItem>
        ))}
      </Menu>

      {/* EVENTO → Añadir → Rango (3º nivel) */}
      <Menu anchorEl={evAddRangeAnchorEl}
        open={!!eventMenu && activeTopEvent === 'add' && activeEvAddSub === 'range' && !!evAddRangeAnchorEl}
        onClose={() => setActiveEvAddSub(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }} PaperProps={{ sx: { minWidth: 240 } }}
        transitionDuration={100}>
        {EnumTipoFestivo.map((tipo) => (
          <MenuItem key={`ev-add-rango-${tipo}`} disabled={!selectedRange} onClick={() => crearRango(tipo)}>{tipo}</MenuItem>
        ))}
      </Menu>

      {/* EVENTO → Eliminar (2º nivel) */}
      <Menu anchorEl={evDeleteAnchorEl}
        open={!!eventMenu && activeTopEvent === 'delete' && !!evDeleteAnchorEl}
        onClose={() => setActiveTopEvent(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }} PaperProps={{ sx: { minWidth: 260 } }}
        transitionDuration={100}>
        <MenuItem onClick={eliminarFestivoActualPorFecha}>Un festivo (este)</MenuItem>
        <MenuItem onClick={eliminarTodosDelDia}>Todos los del día</MenuItem>
      </Menu>

      {/* EVENTO → Editar (2º nivel) */}
      <Menu anchorEl={evEditAnchorEl}
        open={!!eventMenu && activeTopEvent === 'edit' && !!evEditAnchorEl}
        onClose={() => setActiveTopEvent(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }} PaperProps={{ sx: { minWidth: 260 } }}
        transitionDuration={100}>
        {EnumTipoFestivo.map((tipo) => (
          <MenuItem key={`ev-edit-${tipo}`} onClick={() => editarEventoActualTipo(tipo)}>{tipo}</MenuItem>
        ))}
      </Menu>
    </Paper>
  );
}
