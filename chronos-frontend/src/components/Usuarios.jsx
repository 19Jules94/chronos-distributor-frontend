// src/components/Usuarios.jsx
import * as React from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
  Paper,
  Stack,
  Button,
  IconButton,
  Typography,
  Box,
  Card,
  CardContent,
  // PATCH: Snackbar y Alert
  Snackbar,
  Alert,
  // PATCH: Dialog parts
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import TableChartRoundedIcon from "@mui/icons-material/TableChartRounded";
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded';
import { useTheme, useMediaQuery } from "@mui/material";
import UsuarioEdit from "./Usuario-edit.jsx";
import CursoEscolarPicker from "./CursoEscolarPicker.jsx";
import CountTurnos from "./Count-Turnos.jsx";
import CountTurnosTotales from "./Count-Turnos-Totales.jsx";
import API_BASE from '../lib/apiBase.js';

const toRow = (u) => {
  const t = Number(u.turnoAsignado);
  return {
    id: u.id ?? u.userId,
    nombre: u.nombre ?? u.firstName ?? "",
    apellido1: u.apellido1 ?? u.lastName ?? "",
    apellido2: u.apellido2 ?? u.secondLastName ?? "",
    turnoAsignado: Number.isFinite(t) ? t : null,
    cursoEscolarId: u.cursoEscolarId ?? u.cursoId ?? null,
    esActivo: u.esActivo ?? u.isActive ?? u.activo ?? u.EsActivo ?? u.IsActive ?? false,
  };
};

// --- Confirmación no bloqueante reutilizable ---
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

export default function Usuarios() {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  const [countOpen, setCountOpen] = React.useState(false);
  const [countTotOpen, setCountTotOpen] = React.useState(false);

  const [selectedUser, setSelectedUser] = React.useState(null);
  const [error, setError] = React.useState(null);

  const [cursos, setCursos] = React.useState([]);
  const [cursoActual, setCursoActual] = React.useState(null);

  // Confirmación de borrado
  const [confirmDel, setConfirmDel] = React.useState({
    open: false,
    row: null,
  });

  // PATCH: Snackbar (no bloqueante) + helpers
  const [snack, setSnack] = React.useState({ open: false, severity: 'error', msg: '' });
  const showError = React.useCallback((msg) => {
    setSnack({ open: true, severity: 'error', msg: String(msg || 'Ha ocurrido un error') });
  }, []);
  const showSuccess = React.useCallback((msg) => {
    setSnack({ open: true, severity: 'success', msg: String(msg || 'OK') });
  }, []);
  const handleSnackClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnack(s => ({ ...s, open: false }));
  };

  // PATCH: redirigir cualquier window.alert() a Snackbar
  React.useEffect(() => {
    const native = window.alert?.bind(window);
    window.alert = (msg) => {
      try { showError(msg); } catch { native && native(msg); }
    };
    return () => { if (native) window.alert = native; };
  }, [showError]);

  // ====== TOTAL USUARIOS (N_EMP) ======
  async function apiGetNumUsuariosByCurso(curso) {
    const res = await fetch(`${API_BASE}/Users/num-users-curso-escolar/${curso.id}`, {
      headers: { accept: "*/*" },
    });
    if (!res.ok) throw new Error(`GET /Users/num-users-curso-escolar/${curso.id} -> ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : 0;
  }
  const normalizeNEmp = (val) => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (val && typeof val === "object") {
      if (Number.isFinite(val.total)) return val.total;
      if (Number.isFinite(val.count)) return val.count;
      if (Number.isFinite(val.value)) return val.value;
    }
    const n = Number(val);
    return Number.isFinite(n) ? n : 9;
  };
  const [nEmp, setNEmp] = React.useState(9);
  const loadNEmp = React.useCallback(async (curso) => {
    if (!curso?.id) return;
    try {
      const raw = await apiGetNumUsuariosByCurso(curso);
      setNEmp(normalizeNEmp(raw));
    } catch (e) {
      console.error("Error cargando total de usuarios:", e);
    }
  }, []);
  // ====================================

  const isActive = (u) =>
    u.esActivo === true || u.isActive === true || u.activo === true || u.EsActivo === true || u.IsActive === true;

  const loadCursos = React.useCallback(async () => {
    const res = await fetch(`${API_BASE}/CursoEscolar`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`GET /CursoEscolar -> ${res.status}`);
    const data = await res.json();
    setCursos(data);

    const today = new Date().toISOString().slice(0, 10);
    const cont = data.find((c) => today >= c.fechaInicio && today <= c.fechaFin);
    if (cont) setCursoActual(cont);
    else {
      const pasados = data.filter((c) => c.fechaInicio <= today).sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : -1));
      const futuros = data.filter((c) => c.fechaInicio > today).sort((a, b) => (a.fechaInicio < b.fechaInicio ? -1 : 1));
      setCursoActual(pasados[0] ?? futuros[0] ?? null);
    }
  }, []);

  const loadUsers = React.useCallback(async (cursoId, signal) => {
    if (!cursoId) {
      setRows([]);
      return;
    }
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

  React.useEffect(() => {
    loadCursos().catch((e) => setError(e.message || "Error cargando cursos"));
  }, [loadCursos]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    if (cursoActual?.id) {
      loadUsers(cursoActual.id, ctrl.signal);
      loadNEmp(cursoActual);
    } else {
      setRows([]);
      setNEmp(9);
    }
    return () => ctrl.abort();
  }, [loadUsers, loadNEmp, cursoActual?.id]);

  const openCreate = () => {
    setSelectedUser(null);
    setEditOpen(true);
  };
  const openEdit = (row) => {
    setSelectedUser(row);
    setEditOpen(true);
  };
  const closeDialog = () => setEditOpen(false);

  const openCountTurnos = (row) => {
    setSelectedUser(row ?? null);
    setCountOpen(true);
  };

  const fmtYMD = (s) => (s ? String(s).slice(0, 10) : "");
  const createUserWithCursoDates = async (fechaInicio, fechaFin, user) => {
    const fi = fmtYMD(fechaInicio);
    const ff = fmtYMD(fechaFin);

    const payload = {
      nombre: user?.nombre ?? "",
      apellido1: user?.apellido1 ?? "",
      apellido2: user?.apellido2 ?? "",
      esActivo: user?.esActivo ?? true,
    };

    const res = await fetch(`${API_BASE}/Users/${fi}/${ff}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`POST /Users/${fi}/${ff} -> ${res.status} ${msg}`);
    }
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
    const res = await fetch(`${API_BASE}/Users/${id}`, { method: "PATCH" });
    if (!res.ok) throw new Error(`PATCH /Users/${id} -> ${res.status}`);
  };

  const saveUser = async (formUser) => {
    try {
      const isEdit = Boolean(formUser?.id);

      if (isEdit) {
        await updateUser({ ...formUser });
      } else {
        if (!cursoActual?.fechaInicio || !cursoActual?.fechaFin) {
          setError("Selecciona un curso escolar antes de crear el usuario.");
          showError("Selecciona un curso escolar antes de crear el usuario."); // PATCH
          return;
        }
        const { cursoEscolarId, turnoAsignado, ...rest } = formUser ?? {};
        await createUserWithCursoDates(cursoActual.fechaInicio, cursoActual.fechaFin, rest);
      }

      const cursoId = cursoActual?.id ?? null;
      if (cursoId) {
        await loadUsers(cursoId);
        await loadNEmp({ id: cursoId });
      }
      setEditOpen(false);
      showSuccess(isEdit ? "Usuario actualizado." : "Usuario creado."); // PATCH
    } catch (e) {
      console.error(e);
      const msg = e?.message || "No se pudo guardar el usuario";
      setError(msg);
      showError(msg); // PATCH
    }
  };

  // Reemplazo de confirm() por diálogo no bloqueante
  const deleteUser = async (row) => {
    setConfirmDel({ open: true, row });
  };

  const handleConfirmDelete = async () => {
    const row = confirmDel.row;
    setConfirmDel({ open: false, row: null });
    if (!row) return;
    try {
      await removeUser(row.id);
      await loadUsers(cursoActual?.id);
      if (cursoActual?.id) await loadNEmp(cursoActual);
      showSuccess("Usuario eliminado.");
    } catch (e) {
      console.error(e);
      const msg = "No se pudo eliminar el usuario";
      setError(msg);
      showError(msg);
    }
  };

  const columns = [
    { field: "nombre", headerName: "Nombre", flex: 1.2, minWidth: 140, align: "center", headerAlign: "center", sortable: false },
    { field: "apellido1", headerName: "Apellido 1", flex: 1, minWidth: 140, align: "center", headerAlign: "center", sortable: false },
    { field: "apellido2", headerName: "Apellido 2", flex: 1, minWidth: 140, align: "center", headerAlign: "center", sortable: false },
    { field: "turnoAsignado", headerName: "Turno", flex: 0.6, minWidth: 90, align: "center", headerAlign: "center", sortable: false },
    {
      field: "actions",
      headerName: "Acciones",
      flex: 0.8,
      minWidth: 150,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); openCountTurnos(params.row); }}>
            <TableChartRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="primary" className="edit-bnt" onClick={(e) => { e.stopPropagation(); openEdit(params.row); }}>
            <EditRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" className="rmv-bnt" onClick={(e) => { e.stopPropagation(); deleteUser(params.row); }}>
            <DeleteForeverRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  const takenTurnos = React.useMemo(() => {
    const set = new Set();
    for (const r of rows ?? []) {
      const n = Number(r.turnoAsignado);
      if (Number.isFinite(n)) set.add(n);
    }
    return set;
  }, [rows]);

  const availableTurnos = React.useMemo(() => {
    const n = Number.isFinite(nEmp) ? nEmp : 9;
    const all = Array.from({ length: n }, (_, i) => i + 1);
    return all.filter((t) => !takenTurnos.has(t));
  }, [nEmp, takenTurnos]);

  const columnVisibilityModel = React.useMemo(() => {
    if (isMdDown) {
      return { apellido2: false, apellido1: true, nombre: true, turnoAsignado: true, actions: true };
    }
    return { apellido2: true, apellido1: true, nombre: true, turnoAsignado: true, actions: true };
  }, [isMdDown]);

  const gridSizes = React.useMemo(() => {
    return {
      rowHeight: isMdDown ? 40 : 44,
      columnHeaderHeight: isMdDown ? 44 : 56,
      density: "compact",
    };
  }, [isMdDown]);

  return (
    <Paper sx={{ p: { xs: 1, md: 2 }, width: "100%" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <CursoEscolarPicker
            cursos={cursos}
            cursoActualId={cursoActual?.id ?? ""}
            onChangeCurso={async (idSel) => {
              const sel = cursos.find((c) => c.id === idSel) || null;
              setCursoActual(sel);
              if (sel) {
                await loadUsers(sel.id);
                await loadNEmp(sel);
              } else {
                setRows([]);
                setNEmp(9);
              }
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
                setCursos((prev) => [...prev, nuevo].sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : -1)));
                setCursoActual(nuevo);
                await loadUsers(nuevo.id);
                await loadNEmp(nuevo);
                return true;
              } catch (e) {
                setError(e.message || "Error creando curso");
                showError(e.message || "Error creando curso"); // PATCH
                return false;
              }
            }}
          />
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Button variant="outlined" startIcon={<FormatListNumberedRoundedIcon />} onClick={() => setCountTotOpen(true)} disabled={!cursoActual?.id} size={isXs ? "small" : "medium"}>
            Numero de Turnos
          </Button>
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => cursoActual?.id && loadUsers(cursoActual.id)} size={isXs ? "small" : "medium"}>
            Refrescar
          </Button>
          <Button variant="contained" color="success" startIcon={<PersonAddAlt1RoundedIcon />} onClick={openCreate} size={isXs ? "small" : "medium"}>
            Añadir usuario
          </Button>
        </Stack>
      </Stack>

      {isXs ? (
        <Box>
          {rows.length === 0 && (
            <Typography variant="body2" sx={{ color: "text.secondary", px: 1, py: 1 }}>
              {loading ? "Cargando…" : "No hay usuarios."}
            </Typography>
          )}

          <Stack spacing={1}>
            {rows.map((r, idx) => (
              <Card key={r.id ?? idx} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                        {r.nombre} {r.apellido1}
                      </Typography>
                      {r.apellido2 ? (
                        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.2 }}>
                          {r.apellido2}
                        </Typography>
                      ) : null}
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Turno: {r.turnoAsignado ?? "—"}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" color="primary" onClick={() => openCountTurnos(r)}>
                        <TableChartRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="primary" className="edit-bnt" onClick={() => openEdit(r)}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" className="rmv-bnt" onClick={() => deleteUser(r)}>
                        <DeleteForeverRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>

          {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
        </Box>
      ) : (
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <div style={{ minWidth: 560 }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              autoHeight
              density={"compact"}
              disableColumnMenu
              disableColumnFilter
              disableColumnResize
              disableColumnSorting
              disableRowSelectionOnClick
              pageSizeOptions={[5, 10, 25, 100]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              columnVisibilityModel={columnVisibilityModel}
              rowHeight={gridSizes.rowHeight}
              columnHeaderHeight={gridSizes.columnHeaderHeight}
              sx={{
                "& .MuiDataGrid-columnHeaders": { bgcolor: "#282828" },
                "& .MuiDataGrid-columnHeadersInner": { bgcolor: "#282828" },
                "& .MuiDataGrid-columnHeader": { backgroundColor: "#282828" },
                "& .MuiDataGrid-filler": { backgroundColor: "#282828" },
                "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 700, color: "#ffffff" },
                color: "#111827",
                "& .MuiDataGrid-row:nth-of-type(even)": { backgroundColor: "#f9fafb" },
                "& .MuiDataGrid-row:hover": { backgroundColor: "#eef2ff" },
                "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "#dbeafe", "&:hover": { backgroundColor: "#bfdbfe" } },
                "& .MuiDataGrid-cell": { borderColor: "#e5e7eb", px: { xs: 0.5, sm: 1 } },
                "& .MuiDataGrid-columnSeparator": { color: "#374151" },
                "& .MuiDataGrid-footerContainer": { bgcolor: "#f3f4f6" },
                "& .MuiIconButton-root": { color: "#2563eb" },
                ".edit-bnt": { color: "#ffc20e" },
                ".rmv-bnt": { color: "#e01f3d" },
                "& .MuiIconButton-root.Mui-error": { color: "#dc2626" },
              }}
            />
          </div>
        </Box>
      )}

      {!isXs && error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}

      <UsuarioEdit
        open={editOpen}
        user={selectedUser}
        onClose={closeDialog}
        onSave={saveUser}
        totalUsuarios={nEmp}
        availableTurnos={availableTurnos}
        cursoSeleccionado={{
          fechaInicio: cursoActual?.fechaInicio ?? null,
          fechaFin: cursoActual?.fechaFin ?? null,
        }}
      />

      <CountTurnos
        open={countOpen}
        onClose={() => setCountOpen(false)}
        cursoId={cursoActual?.id ?? null}
        turnoAsignado={selectedUser?.turnoAsignado ?? null}
        usuarioId={selectedUser?.id ?? null}
        nombre={[
          selectedUser?.nombre,
          selectedUser?.apellido1,
          selectedUser?.apellido2
        ].filter(Boolean).join(" ")}
      />

      <CountTurnosTotales
        open={countTotOpen}
        onClose={() => setCountTotOpen(false)}
        cursoId={cursoActual?.id ?? null}
      />

      {/* Diálogo de confirmación de borrado (no bloqueante) */}
      <ConfirmDialog
        open={confirmDel.open}
        title="Eliminar usuario"
        message={
          confirmDel.row
            ? `¿Eliminar a ${[confirmDel.row.nombre, confirmDel.row.apellido1, confirmDel.row.apellido2].filter(Boolean).join(" ")}?`
            : "¿Eliminar usuario?"
        }
        onCancel={() => setConfirmDel({ open: false, row: null })}
        onConfirm={handleConfirmDelete}
      />

      {/* PATCH: Snackbar global (no bloqueante) */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={handleSnackClose}>
        <Alert onClose={handleSnackClose} severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
