// src/components/Calendario-edit.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import {
  Paper,
  Stack,
  Button,
  Typography,
  Menu,
  MenuItem,
  ListItemText,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons';
import XLSX from 'xlsx-js-style';
import CursoEscolarPicker from './CursoEscolarPicker.jsx';
import { generateSchedule, addDays, fromYmd, ymd } from '../lib/chronos.js';
import API_BASE from '../lib/apiBase.js';

// ================== CONFIG API ==================
const EnumTipoFestivo = ['Navidad', 'FestivoNacional', 'Carnavales', 'SemanaSanta', 'FestivoLectivo'];
const FESTIVO_COLORS = {
  Navidad: "#43a047",
  FestivoNacional: "#ff3c41",
  Carnavales: "#ffaaaa",
  SemanaSanta: "#4a8594",
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
async function readErrorMessage(res) {
  let raw = '';
  try { raw = await res.text(); } catch { /* ignore */ }

  if (!raw) return `HTTP ${res.status}`;

  try {
    const data = JSON.parse(raw);
    return (
      data?.message ||
      data?.detail ||
      data?.title ||
      (typeof data === 'string' ? data : JSON.stringify(data))
    );
  } catch {
    return raw;
  }
}
// --- Confirmación no bloqueante ---
function ConfirmDialog({ open, title, message, onCancel, onConfirm }) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{title || "Confirmar"}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="contained" color="error" onClick={onConfirm}>Continuar</Button>
      </DialogActions>
    </Dialog>
  );
}

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

async function apiCrearCursoEscolar({ fechaInicio, fechaFin }) {
  const res = await fetch(`${API_BASE}/CursoEscolar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify({ fechaInicio, fechaFin }),
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res).catch(() => '');
    throw new Error(`Error al crear curso (${res.status}) ${msg || ''}`.trim());
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
    const msg = await readErrorMessage(res).catch(() => '');
    throw new Error(`Error al cargar turnos del curso (${res.status}) ${msg || ''}`.trim());
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
  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(msg || `Error al crear festivo (día) (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : { fecha, tipoFestivo };
}

async function apiCrearFestivosRango(payloadArray) {
  const res = await fetch(`${API_BASE}/Festivos/crear_festivos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payloadArray),
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(msg || `Error al crear festivos (rango) (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : payloadArray;
}

async function apiEliminarFestivoPorFecha(fecha) {
  const res = await fetch(`${API_BASE}/Festivos/${fecha}`, { method: 'DELETE', headers: { accept: '*/*' } });
  if (!res.ok) throw new Error(`Error al eliminar festivo por fecha (${res.status})`);
}

async function apiCrearTurnos(payloadArray) {
  const res = await fetch(`${API_BASE}/Turnos/crear_Turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payloadArray),
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res).catch(() => '');
    throw new Error(`Error al crear turnos (rango) (${res.status}) ${msg || ''}`.trim());
  }
  const text = await res.text();
  return text ? JSON.parse(text) : payloadArray;
}

async function apiEliminarFestivosPorRangoFechas(fechasYYYYMMDD) {
  const res = await fetch(`${API_BASE}/Festivos`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(fechasYYYYMMDD),
  });
  if (!res.ok) throw new Error(`Error al eliminar festivos por rango (${res.status})`);
}

async function apiEliminarTurnosPorFechas(fechasYYYYMMDD) {
  const res = await fetch(`${API_BASE}/Turnos/eliminar-turnos`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(fechasYYYYMMDD),
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res).catch(() => '');
    throw new Error(`Error al eliminar turnos (${res.status}) ${msg || ''}`.trim());
  }
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
  const base = FESTIVO_COLORS[f.tipoFestivo] || "#546e7a";
  const bg = hexToRgba(base, 0.25);

  return [
    {
      id: `bg-${id}`,
      start: f.fecha,
      allDay: true,
      display: "background",
      backgroundColor: bg,
      extendedProps: { tipo: "festivo", tipoFestivo: f.tipoFestivo, esFondo: true },
    },
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

// ========== Turnos desde BD ==========
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
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
  });
  // Snackbar
  const [snack, setSnack] = useState({ open: false, severity: 'error', msg: '' });
  const showError = useCallback((msg) => {
    closeAllContextMenus();
    setSnack({ open: true, severity: 'error', msg: String(msg || 'Ha ocurrido un error') });
  }, []);
  const showSuccess = useCallback((msg) => {
    setSnack({ open: true, severity: 'success', msg: String(msg || 'OK') });
  }, []);
  const handleSnackClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnack(s => ({ ...s, open: false }));
  };

  // PATCH: redirige cualquier window.alert() a Snackbar (no bloqueante)
  useEffect(() => {
    const native = window.alert?.bind(window);
    window.alert = (msg) => {
      try { showError(msg); } catch { native && native(msg); }
    };
    return () => { if (native) window.alert = native; };
  }, [showError]);
  // END PATCH

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
      showError('No se pudo cargar el número de empleados del curso.');
    }
  }, [showError]);

  const lastDiasRef = useRef(null);

  // Menús (día)
  const [dayMenu, setDayMenu] = useState(null);
  const [activeTopDay, setActiveTopDay] = useState(null);
  const [addAnchorEl, setAddAnchorEl] = useState(null);
  const [deleteAnchorEl, setDeleteAnchorEl] = useState(null);
  const [editAnchorEl, setEditAnchorEl] = useState(null);
  const [activeAddSub, setActiveAddSub] = useState(null);
  const [addSingleAnchorEl, setAddSingleAnchorEl] = useState(null);
  const [addRangeAnchorEl, setAddRangeAnchorEl] = useState(null);

  // Menús (evento)
  const [eventMenu, setEventMenu] = useState(null);
  const [activeTopEvent, setActiveTopEvent] = useState(null);
  const [evAddAnchorEl, setEvAddAnchorEl] = useState(null);
  const [evDeleteAnchorEl, setEvDeleteAnchorEl] = useState(null);
  const [evEditAnchorEl, setEvEditAnchorEl] = useState(null);
  const [activeEvAddSub, setActiveEvAddSub] = useState(null);
  const [evAddSingleAnchorEl, setEvAddSingleAnchorEl] = useState(null);
  const [evAddRangeAnchorEl, setEvAddRangeAnchorEl] = useState(null);

  // Util: cerrar todo overlay/menús + limpiar selección
  const closeAllContextMenus = useCallback(() => {
    setDayMenu(null);
    setEventMenu(null);

    setActiveTopDay(null);
    setActiveTopEvent(null);

    setAddAnchorEl(null);
    setDeleteAnchorEl(null);
    setEditAnchorEl(null);
    setActiveAddSub(null);
    setAddSingleAnchorEl(null);
    setAddRangeAnchorEl(null);

    setEvAddAnchorEl(null);
    setEvDeleteAnchorEl(null);
    setEvEditAnchorEl(null);
    setActiveEvAddSub(null);
    setEvAddSingleAnchorEl(null);
    setEvAddRangeAnchorEl(null);

    try { calendarRef.current?.getApi?.()?.unselect?.(); } catch { /* ignore */ }
  }, []);

  // Rango seleccionado
  const [selectedRange, setSelectedRange] = useState(null);

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
      showError('No se pudieron cargar los festivos.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

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
      showError(`No se pudieron cargar los turnos del servidor: ${e.message}`);
    }
  }, [cursoActual?.id, showError]);

  // Generar horario local
  const generarHorarioPythonLike = useCallback(() => {
    if (!cursoActual) {
      showError('No hay curso escolar seleccionado/cargado.');
      return;
    }
    const startISO = cursoActual.fechaInicio;
    const endExcl = ymd(addDays(fromYmd(cursoActual.fechaFin), 1));
    const holidays = Array.from(festivosSet);
    const { dias, events: newEventsRaw } = generateSchedule({
      startISO, endISOExclusive: endExcl, holidays, N_EMP: nEmpRef.current, seed: 42,
    });

    const newEvents = (newEventsRaw || []).map(ev => {
      const tipo = String(ev?.extendedProps?.tipo || '');
      if (tipo.startsWith('turno')) {
        const num = ev?.extendedProps?.turnoAsignado ?? ev?.turno ?? ev?.num ?? '';
        const title = (ev.title && String(ev.title).trim()) ? ev.title : (num ? `T ${num}` : 'T');
        return {
          ...ev,
          title,
          color: undefined,
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: '#000',
          extendedProps: { ...ev.extendedProps, asignado: false },
        };
      }
      return ev;
    });

    lastDiasRef.current = dias;

    setEvents(prev => {
      const prevSinTurnos = prev.filter(
        e => !String(e?.extendedProps?.tipo || '').startsWith('turno')
      );
      return [...prevSinTurnos, ...newEvents];
    });
  }, [cursoActual, festivosSet, nEmpRef, showError]);

  // Exportar a Excel
  const exportarExcel = () => {
    if (!cursoActual) { showError('Selecciona un curso.'); return; }

    const MESES_POR_FILA = 4;
    const COL_IZQ_MARGEN = 2;
    const FILA_SUP_MARGEN = 2;

    const ALT_FILA_HEADER = 22;
    const ALT_FILA_DOW = 18;
    const ALT_FILA_SEMANA = 34;
    const WCH_DIA = 8;

    const BORDER_THIN = {
      top: { style: 'thin', color: { rgb: 'DDDDDD' } },
      left: { style: 'thin', color: { rgb: 'DDDDDD' } },
      right: { style: 'thin', color: { rgb: 'DDDDDD' } },
      bottom: { style: 'thin', color: { rgb: 'DDDDDD' } },
    };

    const STYLE_HEADER = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '2F5597' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const STYLE_DOW = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '7D99C6' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const STYLE_DAY = {
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
      border: BORDER_THIN
    };

    const XLSX_COLOR_BY_TIPO = {
      Navidad: "E53935",
      FestivoNacional: "ff3c41",
      Carnavales: "FB8C00",
      SemanaSanta: "8E24AA",
      FestivoLectivo: "43A047",
    };
    const festivoFillByTipo = (tipo) => {
      if (!tipo) return null;
      const rgb = XLSX_COLOR_BY_TIPO[String(tipo)] || "546E7A";
      return { patternType: "solid", fgColor: { rgb } };
    };

    const colToA1 = (col) => {
      let s = '', n = col;
      while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
      return s;
    };
    const addr = (c, r) => `${colToA1(c)}${r}`;
    const dowMon0 = (d) => (d.getDay() + 6) % 7;

    const turnosPorFecha = new Map();
    for (const ev of events) {
      if (ev?.extendedProps?.tipo !== 'turno-db') continue;
      const iso = typeof ev.start === 'string'
        ? ev.start.slice(0, 10)
        : ev.start instanceof Date ? fmtDateOnly(ev.start) : null;
      if (!iso) continue;
      const txt = (ev.title ?? `T ${ev?.extendedProps?.turnoAsignado ?? ''}`).trim();
      const lst = turnosPorFecha.get(iso) ?? [];
      if (txt) lst.push(txt);
      turnosPorFecha.set(iso, lst);
    }

    const festivoTipoPorFecha = new Map();
    for (const ev of events) {
      if (ev?.extendedProps?.tipo !== 'festivo') continue;
      const iso = typeof ev.start === 'string'
        ? ev.start.slice(0, 10)
        : ev.start instanceof Date ? fmtDateOnly(ev.start) : null;
      if (!iso) continue;
      const tipo = ev?.extendedProps?.tipoFestivo ?? ev?.title ?? null;
      if (!tipo) continue;
      festivoTipoPorFecha.set(iso, tipo);
    }

    const wb = XLSX.utils.book_new();
    const ws = {};
    ws['!merges'] = [];
    ws['!cols'] = [];
    ws['!rows'] = [];

    const start = dateFromYMD(cursoActual.fechaInicio);
    const end = dateFromYMD(cursoActual.fechaFin);
    const firstMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    const MESES = [];
    for (let d = new Date(firstMonth); d <= lastMonth; d.setMonth(d.getMonth() + 1)) {
      MESES.push(new Date(d.getFullYear(), d.getMonth(), 1));
    }

    const COLS_POR_MES = 7;
    const GAP_COL = 1;
    const FILAS_HEADER = 1;
    const FILAS_DOW = 1;
    const FILAS_SEMANAS = 6;
    const GAP_FILAS = 1;
    const FILAS_POR_MES = FILAS_HEADER + FILAS_DOW + FILAS_SEMANAS + GAP_FILAS;

    const totalCols = COL_IZQ_MARGEN - 1 + (COLS_POR_MES + GAP_COL) * Math.min(MESES_POR_FILA, MESES.length);
    for (let c = 1; c <= totalCols + 20; c++) ws['!cols'][c - 1] = { wch: WCH_DIA };

    MESES.forEach((firstDayOfMonth, idx) => {
      const rowBlock = Math.floor(idx / MESES_POR_FILA);
      const colBlock = idx % MESES_POR_FILA;

      const startCol = COL_IZQ_MARGEN + colBlock * (COLS_POR_MES + GAP_COL);
      const startRow = FILA_SUP_MARGEN + rowBlock * FILAS_POR_MES;

      const y = firstDayOfMonth.getFullYear();
      const m = firstDayOfMonth.getMonth();
      const nombreMes = firstDayOfMonth.toLocaleString('es-ES', { month: 'long' }).toUpperCase();

      const rHeader = startRow;
      const c1 = startCol, c7 = startCol + 6;
      ws[addr(c1, rHeader)] = { v: `${nombreMes} ${y}`, t: 's', s: STYLE_HEADER };
      ws['!merges'].push({ s: { r: rHeader - 1, c: c1 - 1 }, e: { r: rHeader - 1, c: c7 - 1 } });
      ws['!rows'][rHeader - 1] = { hpt: ALT_FILA_HEADER };

      const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
      const rDOW = startRow + 1;
      ws['!rows'][rDOW - 1] = { hpt: ALT_FILA_DOW };
      for (let i = 0; i < 7; i++) {
        const cell = addr(startCol + i, rDOW);
        ws[cell] = { v: DOW[i], t: 's', s: STYLE_DOW };
      }

      const offset = dowMon0(new Date(y, m, 1));
      const lastDay = new Date(y, m + 1, 0).getDate();

      for (let week = 0; week < 6; week++) {
        const r = startRow + 2 + week;
        ws['!rows'][r - 1] = { hpt: ALT_FILA_SEMANA };
        for (let dow = 0; dow < 7; dow++) {
          const c = startCol + dow;
          const cellAddr = addr(c, r);

          const dayNum = week * 7 + dow - offset + 1;
          if (dayNum < 1 || dayNum > lastDay) {
            ws[cellAddr] = { v: '', t: 's', s: STYLE_DAY };
            continue;
          }

          const d = new Date(y, m, dayNum);
          const iso = fmtDateOnly(d);

          if (iso < cursoActual.fechaInicio || iso > cursoActual.fechaFin) {
            ws[cellAddr] = { v: '', t: 's', s: STYLE_DAY };
            continue;
          }

          const nombres = (turnosPorFecha.get(iso) ?? []).join('\n');
          const text = nombres ? `${dayNum}\n${nombres}` : String(dayNum);

          let style = (dow >= 5) ? { ...STYLE_DAY, fill: { patternType: 'solid', fgColor: { rgb: 'EDEFF5' } } } : STYLE_DAY;

          const tipoFestivo = festivoTipoPorFecha.get(iso);
          const festFill = festivoFillByTipo(tipoFestivo);
          if (festFill) style = { ...style, fill: festFill };

          ws[cellAddr] = { v: text, t: 's', s: style };
        }
      }
    });

    const rowsUsed = FILA_SUP_MARGEN + Math.ceil(MESES.length / MESES_POR_FILA) * (1 + 1 + 6 + 1);
    const colsUsed = COL_IZQ_MARGEN - 1 + (7 + 1) * Math.min(MESES_POR_FILA, MESES.length) - 1;
    ws['!ref'] = `A1:${addr(colsUsed, rowsUsed)}`;

    XLSX.utils.book_append_sheet(wb, ws, 'Calendario');

    const etiquetaCurso = `${cursoActual.fechaInicio}__${cursoActual.fechaFin}`;
    XLSX.writeFile(wb, `Calendario_${etiquetaCurso}.xlsx`);
    showSuccess('Excel generado.');
  };

  const guardarHorario = useCallback(async () => {
    try {
      if (!cursoActual) { showError('Primero selecciona un curso.'); return; }

      // 1) ¿Existen turnos ya guardados en BD para este curso?
      let existentes = [];
      try {
        existentes = await apiTurnosPorCursoConNombres(cursoActual.id);
      } catch {
        existentes = [];
      }

      if (Array.isArray(existentes) && existentes.length > 0) {
        const fechasAEliminar = [...new Set(
          existentes
            .map(t => (t.fecha ?? t.Fecha ?? '').slice(0, 10))
            .filter(Boolean)
        )];

        setConfirmState({
          open: true,
          title: "Reemplazar turnos del curso",
          message:
            `Ya existen turnos creados para este curso (${existentes.length}).\n\n` +
            `Si continúas, se BORRARÁN (${fechasAEliminar.length} días afectado/s) y se reemplazarán por los nuevos.\n\n` +
            `¿Deseas continuar?`,
          onConfirm: async () => {
            try {
              setConfirmState(s => ({ ...s, open: false }));
              if (fechasAEliminar.length > 0) {
                await apiEliminarTurnosPorFechas(fechasAEliminar);
              }
              // Limpieza visual
              setEvents(prev => prev.filter(e => e?.extendedProps?.tipo !== 'turno-db'));

              // 3) Asegurar días generados
              let dias = lastDiasRef.current;
              if (!dias) {
                const startISO = cursoActual.fechaInicio;
                const endExcl = ymd(addDays(fromYmd(cursoActual.fechaFin), 1));
                const holidays = Array.from(festivosSet);
                const gen = generateSchedule({ startISO, endISOExclusive: endExcl, holidays, N_EMP: nEmpRef.current, seed: 42 });
                dias = gen.dias;
                lastDiasRef.current = dias;
              }

              const payload = diasToTurnosPayload(dias);
              if (payload.length === 0) { showError('No hay turnos que guardar.'); return; }

              await apiCrearTurnos(payload);
              showSuccess(`Horario guardado (${payload.length} turnos).`);

              await refreshTurnosFromServer();
            } catch (e) {
              console.error('Error guardando horario:', e);
              showError(`Error guardando horario: ${e.message}`);
            }
          },
        });
        return; // importante: salimos y esperamos a la confirmación
      }

      // 3) Asegurar días generados
      let dias = lastDiasRef.current;
      if (!dias) {
        const startISO = cursoActual.fechaInicio;
        const endExcl = ymd(addDays(fromYmd(cursoActual.fechaFin), 1));
        const holidays = Array.from(festivosSet);
        const gen = generateSchedule({ startISO, endISOExclusive: endExcl, holidays, N_EMP: nEmpRef.current, seed: 42 });
        dias = gen.dias;
        lastDiasRef.current = dias;
      }

      const payload = diasToTurnosPayload(dias);
      if (payload.length === 0) { showError('No hay turnos que guardar.'); return; }

      // 4) Crear nuevos turnos
      await apiCrearTurnos(payload);
      showSuccess(`Horario guardado (${payload.length} turnos).`);

      // 5) Refrescar desde BD
      await refreshTurnosFromServer();
    } catch (e) {
      console.error('Error guardando horario:', e);
      showError(`Error guardando horario: ${e.message}`);
    }
  }, [cursoActual, festivosSet, refreshTurnosFromServer, nEmpRef, showError, showSuccess]);

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
      showError('No se pudieron cargar los cursos.');
    }
  }, [showError]);
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
      await loadNEmp(cursoActual);
    })();
  }, [cursoActual?.id, cursoActual?.fechaInicio, loadFestivosPorCurso, refreshTurnosFromServer, loadNEmp]);

  // Recargar N_EMP al volver al foco
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
      if (!fechaPerteneceAlCurso(fecha, cursoActual)) { showError(`La fecha ${fecha} no pertenece al curso seleccionado.`); return; }
      await apiCrearFestivoDia({ fecha, tipoFestivo });
      await loadFestivosPorCurso(cursoActual);
      showSuccess('Festivo creado.');
    } catch (e) {
      console.error('Error creando festivo (día):', e);
      showError(e.message || 'No se pudo crear el festivo.');
    }
    closeAllContextMenus();
  }, [dayMenu, cursoActual, loadFestivosPorCurso, showError, showSuccess, closeAllContextMenus]);

  const crearRango = useCallback(async (tipoFestivo) => {
    try {
      if (!selectedRange || !cursoActual) return;
      const fechas = Array.from(daysBetween(selectedRange.start, selectedRange.end));
      const fuera = fechas.find(f => !fechaPerteneceAlCurso(f, cursoActual));
      if (fuera) { showError(`La fecha ${fuera} está fuera del curso seleccionado.`); return; }
      const payload = fechas.map(fecha => ({ fecha, tipoFestivo }));
      await apiCrearFestivosRango(payload);
      await loadFestivosPorCurso(cursoActual);
      showSuccess(`Se crearon ${payload.length} festivos.`);
    } catch (e) {
      console.error('Error creando festivos (rango):', e);
      showError(e.message || 'No se pudieron crear los festivos.');
    }
    clearSelection();
    closeAllContextMenus();
  }, [selectedRange, cursoActual, loadFestivosPorCurso, showError, showSuccess, closeAllContextMenus]);

  const eliminarFestivoActualPorFecha = useCallback(async () => {
    const ev = eventMenu?.event;
    const dateISO = ev?.startStr?.slice(0, 10) || (ev?.start instanceof Date ? fmtDateOnly(ev.start) : null);
    if (!dateISO) return;
    try {
      await apiEliminarFestivoPorFecha(dateISO);
      await loadFestivosPorCurso(cursoActual);
      showSuccess('Festivo eliminado.');
    } catch (e) {
      console.error('Error eliminando por fecha:', e);
      showError('No se pudo eliminar el festivo.');
    }
    closeAllContextMenus();
  }, [eventMenu, cursoActual, loadFestivosPorCurso, showError, showSuccess, closeAllContextMenus]);

  const eliminarTodosDelDia = useCallback(async () => {
    const dateISO =
      eventMenu?.event?.startStr?.slice(0, 10) ||
      (eventMenu?.event?.start instanceof Date ? fmtDateOnly(eventMenu.event.start) : null) ||
      (dayMenu?.date ? fmtDateOnly(dayMenu.date) : null);
    if (!dateISO) return;
    try {
      await apiEliminarFestivoPorFecha(dateISO);
      await loadFestivosPorCurso(cursoActual);
      showSuccess('Festivos del día eliminados.');
    } catch (e) {
      console.error('Error eliminando por fecha:', e);
      showError('No se pudo eliminar ese día.');
    }
    closeAllContextMenus();
  }, [dayMenu, eventMenu, cursoActual, loadFestivosPorCurso, showError, showSuccess, closeAllContextMenus]);

  const eliminarRangoSeleccionado = useCallback(async () => {
    if (!selectedRange) return;
    try {
      const fechas = Array.from(daysBetween(selectedRange.start, selectedRange.end));
      if (fechas.length === 0) return;
      await apiEliminarFestivosPorRangoFechas(fechas);
      await loadFestivosPorCurso(cursoActual);
      showSuccess(`Eliminados ${fechas.length} festivos del rango.`);
    } catch (e) {
      console.error('Error eliminando festivos (rango):', e);
      showError('No se pudieron eliminar los festivos del rango.');
    }
    clearSelection();
    closeAllContextMenus();
  }, [selectedRange, cursoActual, loadFestivosPorCurso, showError, showSuccess, closeAllContextMenus]);

  // EDITAR (solo título local del evento festivo)
  const editarEventoActualTipo = useCallback((nuevoTipo) => {
    const ev = eventMenu?.event;
    if (!ev) return;

    const dateISO = ev?.startStr?.slice(0, 10) || (ev?.start instanceof Date ? fmtDateOnly(ev.start) : null);
    if (!dateISO) { setEventMenu(null); return; }

    setEvents(prev => {
      const rest = prev.filter(e => {
        const iso = typeof e.start === 'string'
          ? e.start.slice(0, 10)
          : e.start instanceof Date ? fmtDateOnly(e.start) : null;
        const esMismoDia = iso === dateISO;
        const esFestivo = e?.extendedProps?.tipo === 'festivo' || e?.display === 'background';
        return !(esMismoDia && esFestivo);
      });

      return [...rest, ...festivoToEvents({ fecha: dateISO, tipoFestivo: nuevoTipo })];
    });

    closeAllContextMenus();
  }, [eventMenu, closeAllContextMenus]);

  const hasTurnos = useMemo(
    () => events.some(e => ['turno-noche', 'turno-viernes'].includes(e?.extendedProps?.tipo)),
    [events]
  );

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
                await loadNEmp(sel);
              }
            }}
            onCreateCurso={async ({ fechaInicio, fechaFin }) => {
              try {
                const nuevo = await apiCrearCursoEscolar({ fechaInicio, fechaFin });
                setCursos(prev => [...prev, nuevo].sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : -1)));
                setCursoActual(nuevo);
                const api = calendarRef.current?.getApi?.();
                if (api && nuevo.fechaInicio) api.gotoDate(dateFromYMD(nuevo.fechaInicio));
                setEvents([]); setFestivosSet(new Set()); lastDiasRef.current = null;
                await loadFestivosPorCurso(nuevo);
                await refreshTurnosFromServer(nuevo.id);
                await loadNEmp(nuevo);
                showSuccess('Curso escolar creado.');
                return true;
              } catch (e) {
                console.error('Crear curso escolar:', e);
                showError(e.message);
                return false;
              }
            }}
          />
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
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

          <Button variant="contained" color="success"
            startIcon={<FontAwesomeIcon icon={faFileExport} />}
            onClick={exportarExcel}
            disabled={!cursoActual}
          >
            Exportar a Excel
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
        headerToolbar={false}
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
        eventContent={(arg) => {
          const tipo = String(arg.event?.extendedProps?.tipo || '');
          const isFestivo = tipo === 'festivo' && !arg.event?.extendedProps?.esFondo;
          const isTurno = tipo.startsWith('turno');
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

      {/* ===== DÍA: top-level ===== */}
      <Menu
        open={!!dayMenu}
        onClose={() => { setDayMenu(null); setActiveTopDay(null); setAddAnchorEl(null); setDeleteAnchorEl(null); setEditAnchorEl(null); setActiveAddSub(null); setAddSingleAnchorEl(null); setAddRangeAnchorEl(null); }}
        anchorReference="anchorPosition"
        anchorPosition={dayMenu ? { top: dayMenu.mouseY, left: dayMenu.mouseX } : undefined}
        PaperProps={{ sx: { minWidth: 300 } }}
        transitionDuration={100}
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
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
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
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
      <Menu
        anchorEl={addSingleAnchorEl}
        open={!!dayMenu && activeTopDay === 'add' && activeAddSub === 'single' && !!addSingleAnchorEl}
        onClose={() => setActiveAddSub(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 240 } }}
        transitionDuration={100}
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
      >
        {EnumTipoFestivo.map((tipo) => (
          <MenuItem key={`add-dia-${tipo}`} onClick={() => crearUnFestivoEnDia(tipo)}>{tipo}</MenuItem>
        ))}
      </Menu>

      {/* DÍA → Añadir → Rango (3º nivel) */}
      <Menu
        anchorEl={addRangeAnchorEl}
        open={!!dayMenu && activeTopDay === 'add' && activeAddSub === 'range' && !!addRangeAnchorEl}
        onClose={() => setActiveAddSub(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 240 } }}
        transitionDuration={100}
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
      >
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
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
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
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
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
      <Menu
        anchorEl={evAddAnchorEl}
        open={!!eventMenu && activeTopEvent === 'add' && !!evAddAnchorEl}
        onClose={() => setActiveTopEvent(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 260 } }}
        transitionDuration={100}
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
      >
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
      <Menu
        anchorEl={evAddSingleAnchorEl}
        open={!!eventMenu && activeTopEvent === 'add' && activeEvAddSub === 'single' && !!evAddSingleAnchorEl}
        onClose={() => setActiveEvAddSub(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 240 } }}
        transitionDuration={100}
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
      >
        {EnumTipoFestivo.map((tipo) => (
          <MenuItem key={`ev-add-dia-${tipo}`} onClick={() => crearUnFestivoEnDia(tipo)}>{tipo}</MenuItem>
        ))}
      </Menu>

      {/* EVENTO → Añadir → Rango (3º nivel) */}
      <Menu
        anchorEl={evAddRangeAnchorEl}
        open={!!eventMenu && activeTopEvent === 'add' && activeEvAddSub === 'range' && !!evAddRangeAnchorEl}
        onClose={() => setActiveEvAddSub(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 240 } }}
        transitionDuration={100}
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
      >
        {EnumTipoFestivo.map((tipo) => (
          <MenuItem key={`ev-add-rango-${tipo}`} disabled={!selectedRange} onClick={() => crearRango(tipo)}>{tipo}</MenuItem>
        ))}
      </Menu>

      {/* EVENTO → Eliminar (2º nivel) */}
      <Menu
        anchorEl={evDeleteAnchorEl}
        open={!!eventMenu && activeTopEvent === 'delete' && !!evDeleteAnchorEl}
        onClose={() => setActiveTopEvent(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 260 } }}
        transitionDuration={100}
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
      >
        <MenuItem onClick={eliminarFestivoActualPorFecha}>Un festivo (este)</MenuItem>
        <MenuItem onClick={eliminarTodosDelDia}>Todos los del día</MenuItem>
      </Menu>

      {/* EVENTO → Editar (2º nivel) */}
      <Menu
        anchorEl={evEditAnchorEl}
        open={!!eventMenu && activeTopEvent === 'edit' && !!evEditAnchorEl}
        onClose={() => setActiveTopEvent(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 260 } }}
        transitionDuration={100}
        slotProps={{ root: { disableEnforceFocus: true, disableRestoreFocus: true } }}
      >
        {EnumTipoFestivo.map((tipo) => (
          <MenuItem key={`ev-edit-${tipo}`} onClick={() => editarEventoActualTipo(tipo)}>{tipo}</MenuItem>
        ))}
      </Menu>

      {/* Snackbar global */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={handleSnackClose}>
        <Alert onClose={handleSnackClose} severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
        onConfirm={confirmState.onConfirm || (() => setConfirmState(s => ({ ...s, open: false })))}
      />
    </Paper>
  );
}
