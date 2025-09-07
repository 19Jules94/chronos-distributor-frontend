// src/components/Calendario-edit.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { Paper,Stack,Typography } from '@mui/material';
import API_BASE from '../lib/apiBase.js';
import CursoEscolarPicker from './CursoEscolarPicker.jsx';
// ================== CONFIG API ==================


const EnumTipoFestivo = ['Navidad', 'FestivoNacional', 'Carnavales', 'SemanaSanta', 'FestivoLectivo'];
const FESTIVO_COLORS = {
  Navidad:        "#43a047",
  FestivoNacional:"#ff3c41",
  Carnavales:     "#ffaaaa",
  SemanaSanta:    "#4a8594",
  FestivoLectivo: "#ef9421",
};

// Hex → rgba con alpha (para fondos)
function hexToRgba(hex, alpha = 0.3) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

async function apiGetNumUsuariosByCurso(curso) {
  const res = await fetch(`${API_BASE}/Users/num-users-curso-escolar/${curso.id}`, { headers: { accept: '*/*' } });
  if (!res.ok) throw new Error(`Error al listar cursos (${res.status})`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
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
function festivoToEvents(f) {
  const id = String(`${f.fecha}-${f.tipoFestivo}`);
  const base = FESTIVO_COLORS[f.tipoFestivo] || "#546e7a";
  const bg   = hexToRgba(base, 0.25);

  return [
    // Fondo coloreado
    {
      id: `bg-${id}`,
      start: f.fecha,
      allDay: true,
      display: "background",
      backgroundColor: bg,
      extendedProps: { tipo: "festivo", tipoFestivo: f.tipoFestivo, esFondo: true },
    },
    // Píldora con el nombre del tipo
    {
      id,
      title: f.tipoFestivo,
      start: f.fecha,
      allDay: true,
      color: base,
      borderColor: base,
      textColor: "#fff",
      extendedProps: { tipo: "festivo", tipoFestivo: f.tipoFestivo, esFondo: false },
    },
  ];
}

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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

// ========== Turnos desde BD: azul con nombre si está asignado; blanco "T X" si no ==========
function buildEventsFromServerTurnos(list) {
  const PILL_BLUE = "#1976d2";
  return list.map((t, idx) => {
    const fecha = t.fecha ?? t.Fecha;
    const turno = t.turnoAsignado ?? t.TurnoAsignado;

    const usuarioId =
      t.usuarioId ?? t.UsuarioId ?? t.userId ?? t.UserId ??
      t?.usuario?.id ?? t?.Usuario?.Id ?? null;

    const nombreRaw = pickNombreUsuario(t);
    const asignado = Boolean(usuarioId) || Boolean(nombreRaw);

    const titulo = asignado ? onlyNombre(nombreRaw) : `T ${turno}`;

    return {
      id: `turno-${fecha}-${turno}-${usuarioId ?? `idx${idx}`}`,
      title: titulo,
      start: fecha,
      allDay: true,

      // píldora azul solo si está asignado
      color: asignado ? PILL_BLUE : undefined,
      backgroundColor: asignado ? PILL_BLUE : 'transparent',
      borderColor: asignado ? PILL_BLUE : 'transparent',
      textColor: asignado ? '#fff' : '#000',

      extendedProps: {
        tipo: "turno-db",
        turnoAsignado: turno,
        usuarioId,
        asignado,
        nombreUsuario: titulo,
      },
    };
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

  // --- N_EMP dinámico ---
  const [nEmp, setNEmp] = useState(9);
  const nEmpRef = useRef(9);
  const normalizeNEmp = (val) => {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (val && typeof val === 'object') {
      if (Number.isFinite(val.total)) return val.total;
      if (Number.isFinite(val.count)) return val.count;
      if (Number.isFinite(val.value)) return val.value;
    }
    const n = Number(val);
    return Number.isFinite(n) ? n : 9;
  };
  const loadNEmp = useCallback(async (curso) => {
    if (!curso?.id) return;
    try {
      const raw = await apiGetNumUsuariosByCurso(curso);
      const value = normalizeNEmp(raw);
      setNEmp(value);
      nEmpRef.current = value;
    } catch (e) {
      console.error('Error cargando N_EMP:', e);
    }
  }, []);

  const lastDiasRef = useRef(null);

  // Cargar festivos del curso
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

  // Cargar turnos del curso (BD)
  const refreshTurnosFromServer = useCallback(async (forcedCursoId) => {
    const cid = forcedCursoId ?? cursoActual?.id;
    if (!cid) return;
    try {
      const list = await apiTurnosPorCursoConNombres(cid);
      const turnosEvents = buildEventsFromServerTurnos(list);
      setEvents(prev => {
        const soloFestivos = prev.filter(
          e => e?.extendedProps?.tipo === 'festivo' || e?.display === 'background'
        );
        return [...soloFestivos, ...turnosEvents];
      });
      lastDiasRef.current = null;
    } catch (e) {
      console.error('Error refrescando turnos desde BD:', e);
      alert(`No se pudieron cargar los turnos del servidor: ${e.message}`);
    }
  }, [cursoActual?.id]);

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
      await loadNEmp(cursoActual); // cargar N_EMP al cambiar curso
    })();
  }, [cursoActual?.id, cursoActual?.fechaInicio, loadFestivosPorCurso, refreshTurnosFromServer, loadNEmp]);

  // Recargar N_EMP cuando vuelves a esta pestaña/ventana
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && cursoActual?.id) {
        loadNEmp(cursoActual);
      }
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('focus', handler);
    };
  }, [cursoActual?.id, loadNEmp]);

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
          {loading ? ' · cargando…' : ''}
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
                await loadNEmp(sel); // cargar N_EMP al cambiar con el picker
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
                await loadNEmp(nuevo); // cargar N_EMP al crear curso
                return true;
              } catch (e) {
                console.error('Crear curso escolar:', e);
                alert(e.message);
                return false;
              }
            }}
          />
        </Typography>

       
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
        headerToolbar={false}
        firstDay={1}   
        selectMirror
        unselectAuto={false}     
        dayCellDidMount={dayCellDidMount}
        eventDidMount={eventDidMount}
        events={events}
        height="auto"
        dayMaxEvents={4}
        eventDisplay="block"
        eventContent={(arg) => {
          const tipo = String(arg.event?.extendedProps?.tipo || '');
          const isFestivo = tipo === 'festivo' && !arg.event?.extendedProps?.esFondo;
          const isTurno   = tipo.startsWith('turno');
          if (isFestivo || isTurno) {
            const title = arg.event.title || '';
            return {
              html: `<div style="
                white-space: pre-wrap;
                line-height: 1.05;
                font-weight: 700;
                font-size: 0.85em;
              ">${title}</div>`
            };
          }
          return { domNodes: [] };
        }}
      /> 
     
    </Paper>
  );
}
