import * as React from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
  Paper, Stack, Button, IconButton, Typography
} from "@mui/material";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import UsuarioEdit from "./Usuario-edit.jsx";
import CursoEscolarPicker from "./CursoEscolarPicker.jsx";

const API_URL = import.meta.env.VITE_API_URL ?? "https://localhost:7201";
const API_BASE = `${API_URL}/api`;

// ---------- normalizador de usuarios ----------
const toRow = (u) => ({
  id: u.id ?? u.userId,
  nombre: u.nombre ?? u.firstName ?? "",
  apellido1: u.apellido1 ?? u.lastName ?? "",
  apellido2: u.apellido2 ?? u.secondLastName ?? "",
  turnoAsignado: u.turnoAsignado ?? null,
  cursoEscolarId: u.cursoEscolarId ?? u.cursoId ?? null,
  esActivo: u.esActivo ?? u.isActive ?? u.activo ?? u.EsActivo ?? u.IsActive ?? false,
});

export default function Usuarios() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [error, setError] = React.useState(null);

  // cursos
  const [cursos, setCursos] = React.useState([]);
  const [cursoActual, setCursoActual] = React.useState(null);

  // helpers
  const isActive = (u) =>
    u.esActivo === true || u.isActive === true || u.activo === true || u.EsActivo === true || u.IsActive === true;

  const loadCursos = React.useCallback(async () => {
    const res = await fetch(`${API_BASE}/CursoEscolar`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`GET /CursoEscolar -> ${res.status}`);
    const data = await res.json();
    setCursos(data);

    // elegir “curso actual” por rango (igual que en el calendario)
    const today = new Date().toISOString().slice(0,10);
    const cont = data.find(c => today >= c.fechaInicio && today <= c.fechaFin);
    if (cont) setCursoActual(cont);
    else {
      const pasados = data.filter(c => c.fechaInicio <= today).sort((a,b)=> (a.fechaInicio < b.fechaInicio ? 1:-1));
      const futuros = data.filter(c => c.fechaInicio > today).sort((a,b)=> (a.fechaInicio < b.fechaInicio ? -1:1));
      setCursoActual(pasados[0] ?? futuros[0] ?? null);
    }
  }, []);

  // --- API helpers (Users) ---
  const loadUsers = React.useCallback(async (cursoId, signal) => {
    if (!cursoId) { setRows([]); return; }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/Users?cursoId=${cursoId}`, {
        headers: { accept: "application/json" },
        signal,
      });
      if (!res.ok) throw new Error(`GET /Users?cursoId=${cursoId} -> ${res.status}`);
      const data = await res.json();
      const onlyActive = Array.isArray(data) ? data.filter(isActive) : [];
      setRows(onlyActive.map(toRow));
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message ?? "Error cargando usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = async (user) => {
    const res = await fetch(`${API_BASE}/Users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error(`POST /Users -> ${res.status}`);
    return res.json().catch(() => null);
  };

  const updateUser = async (user) => {
    const res = await fetch(`${API_BASE}/Users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error(`PUT /Users/${user.id} -> ${res.status}`);
    return res.json().catch(() => null);
  };

  const removeUser = async (id) => {
    // baja lógica con PATCH (como ya tenías)
    const res = await fetch(`${API_BASE}/Users/${id}`, { method: "PATCH" });
    if (!res.ok) throw new Error(`PATCH /Users/${id} -> ${res.status}`);
  };

  // --- API helpers (Turnos) ---
  const assignUserToTurno = async ({ cursoId, turnoAsignado, usuarioId }) => {
    const url = `${API_BASE}/Turnos/asignar-usuario?cursoId=${cursoId}&turnoAsignado=${turnoAsignado}&usuarioId=${usuarioId}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`asignar-usuario(${turnoAsignado}) -> ${res.status} ${txt}`);
    }
    return res.json().catch(() => null);
  };

  const unassignUserFromTurno = async ({ cursoId, turnoAnterior }) => {
    const url = `${API_BASE}/Turnos/desasignar-usuario?cursoId=${cursoId}&turnoAsignado=${turnoAnterior}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`desasignar-usuario(${turnoAnterior}) -> ${res.status} ${txt}`);
    }
    return res.json().catch(() => null);
  };

  // efectos
  React.useEffect(() => { loadCursos().catch(console.error); }, [loadCursos]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    loadUsers(cursoActual?.id, ctrl.signal);
    return () => ctrl.abort();
  }, [loadUsers, cursoActual?.id]);

  // UI handlers
  const openCreate = () => { setSelectedUser(null); setEditOpen(true); };
  const openEdit = (row) => { setSelectedUser(row); setEditOpen(true); };
  const closeDialog = () => setEditOpen(false);

  const saveUser = async (formUser) => {
    try {
      const isEdit = Boolean(formUser?.id);
      const prevTurno = selectedUser?.turnoAsignado ?? null;
      const newTurno  = formUser?.turnoAsignado ?? null;
      const cursoId   = cursoActual?.id ?? formUser?.cursoEscolarId ?? selectedUser?.cursoEscolarId ?? null;

      if (!cursoId) {
        alert("Selecciona un curso escolar antes de guardar.");
        return;
      }

      // siempre incluir cursoEscolarId (crear y editar)
      const payload = { ...formUser, cursoEscolarId: cursoId };

      if (isEdit) await updateUser(payload);
      else        await createUser(payload);

      // Propagar al calendario (turnos) si cambió el número de turno
      if (isEdit && prevTurno !== newTurno) {
        const usuarioId = selectedUser?.id;
        try {
          if (newTurno == null && prevTurno != null) {
            await unassignUserFromTurno({ cursoId, turnoAnterior: prevTurno });
          } else if (newTurno != null && usuarioId) {
            await assignUserToTurno({ cursoId, turnoAsignado: newTurno, usuarioId });
          }
          // refresca el calendario del curso activo
          window.dispatchEvent(new CustomEvent("turnos:refresh", { detail: { cursoId } }));
        } catch (err) {
          console.error(err);
          alert(err?.message || "Error propagando asignación de turno");
        }
      }

      await loadUsers(cursoId);
      setEditOpen(false);
    } catch (e) {
      console.error(e);
      alert(e?.message || "No se pudo guardar el usuario");
    }
  };

  const deleteUser = async (row) => {
    if (!confirm(`¿Eliminar a ${row.nombre}?`)) return;
    try {
      await removeUser(row.id);
      await loadUsers(cursoActual?.id);
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el usuario");
    }
  };

  const columns = [
    { field: "nombre", headerName: "Nombre", width: 160 },
    { field: "apellido1", headerName: "Apellido 1", width: 160 },
    { field: "apellido2", headerName: "Apellido 2", width: 160 },
    { field: "turnoAsignado", headerName: "Turno Asignado", width: 160 },
    {
      field: "actions",
      headerName: "Acciones",
      sortable: false,
      width: 140,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <>
          <IconButton size="small" color="primary"
            onClick={(e) => { e.stopPropagation(); openEdit(params.row); }}
            aria-label="Editar" title="Editar">
            <EditRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error"
            onClick={(e) => { e.stopPropagation(); deleteUser(params.row); }}
            aria-label="Eliminar" title="Eliminar">
            <DeleteForeverRoundedIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 2, width: "100%" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Usuarios {cursoActual ? `· ${cursoActual.fechaInicio} → ${cursoActual.fechaFin}` : ""}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <CursoEscolarPicker
            cursos={cursos}
            cursoActualId={cursoActual?.id ?? ""}
            onChangeCurso={(idSel) => {
              const sel = cursos.find(c => c.id === idSel) || null;
              setCursoActual(sel);
            }}
            onCreateCurso={async ({ fechaInicio, fechaFin }) => {
              try {
                const res = await fetch(`${API_BASE}/CursoEscolar`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", accept: "*/*" },
                  body: JSON.stringify({ fechaInicio, fechaFin }),
                });
                if (!res.ok) throw new Error(`POST /CursoEscolar -> ${res.status}`);
                const nuevo = await res.json().catch(() => ({ fechaInicio, fechaFin }));
                setCursos(prev => [...prev, nuevo].sort((a,b)=>(a.fechaInicio<b.fechaInicio?1:-1)));
                setCursoActual(nuevo);
                await loadUsers(nuevo.id);
                return true;
              } catch (e) {
                alert(e.message || "Error creando curso");
                return false;
              }
            }}
          />

          <Button variant="outlined" onClick={() => cursoActual?.id && loadUsers(cursoActual.id)}>
            Refrescar
          </Button>
          <Button variant="contained" startIcon={<PersonAddAlt1RoundedIcon />} onClick={openCreate}>
            Añadir usuario
          </Button>
        </Stack>
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
        pageSizeOptions={[5, 10, 25, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
        sx={{
          "& .MuiDataGrid-columnHeaders": { bgcolor: "primary.main", color: "primary.contrastText" },
          "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 700 },
        }}
      />

      {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}

      <UsuarioEdit open={editOpen} user={selectedUser} onClose={closeDialog} onSave={saveUser} />
    </Paper>
  );
}
