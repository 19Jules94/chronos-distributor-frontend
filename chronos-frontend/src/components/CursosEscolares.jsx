// src/components/CursosEscolares.jsx
import * as React from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
  Paper,
  Stack,
  Button,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Box,
  useMediaQuery,
  useTheme,
  // PATCH: añadimos Snackbar y Alert
  Snackbar,
  Alert,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import API_BASE from '../lib/apiBase.js';

async function readApiError(res) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      if (data?.message) return data.message;
      if (data?.detail) return data.detail;
      if (data?.title && data?.status) return `${data.title} (${data.status})`;
      if (data?.title) return data.title;
      if (data?.errors && typeof data.errors === "object") {
        const firstKey = Object.keys(data.errors)[0];
        if (firstKey && Array.isArray(data.errors[firstKey]) && data.errors[firstKey][0]) {
          return data.errors[firstKey][0];
        }
      }
      return JSON.stringify(data);
    }
    const text = await res.text();
    return text || `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

const toRow = (c) => ({ id: c.id, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin });

function CursoEscolarDialog({ open, onClose, initial, onSave }) {
  const [fechaInicio, setFechaInicio] = React.useState(initial?.fechaInicio ?? "");
  const [fechaFin, setFechaFin] = React.useState(initial?.fechaFin ?? "");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setFechaInicio(initial?.fechaInicio ?? "");
    setFechaFin(initial?.fechaFin ?? "");
    setError("");
  }, [initial, open]);

  const validate = () => {
    if (!fechaInicio || !fechaFin) return "Las fechas son obligatorias";
    if (fechaInicio > fechaFin) return "La fecha de inicio debe ser anterior a la de fin";
    return "";
  };

  const handleSave = async () => {
    const e = validate();
    if (e) { setError(e); return; }
    await onSave({ ...initial, fechaInicio, fechaFin });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial?.id ? "Editar curso escolar" : "Nuevo curso escolar"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Fecha inicio"
            type="date"
            value={fechaInicio ?? ""}
            onChange={(e) => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            label="Fecha fin"
            type="date"
            value={fechaFin ?? ""}
            onChange={(e) => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
          {error && <Typography color="error">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave}>Guardar</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CursosEscolares() {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const isSm = useMediaQuery(theme.breakpoints.between("sm", "md"));

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(null);

  // PATCH: Snackbar global local a este componente
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

  // PATCH: redirigir cualquier window.alert() a Snackbar (no bloqueante)
  React.useEffect(() => {
    const native = window.alert?.bind(window);
    window.alert = (msg) => {
      try { showError(msg); } catch { native && native(msg); }
    };
    return () => { if (native) window.alert = native; };
  }, [showError]);

  const loadCursos = React.useCallback(async (signal) => {
    try {
      setLoading(true); setError(null);
      const res = await fetch(`${API_BASE}/CursoEscolar`, { headers: { accept: "application/json" }, signal });
      if (!res.ok) {
        const msg = await readApiError(res);
        throw new Error(msg || `GET /CursoEscolar -> ${res.status}`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data ? [data] : []);
      setRows(list.map(toRow));
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message ?? "Error cargando cursos");
    } finally { setLoading(false); }
  }, []);

  const createCurso = async (curso) => {
    const res = await fetch(`${API_BASE}/CursoEscolar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ fechaInicio: curso.fechaInicio, fechaFin: curso.fechaFin }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      throw new Error(msg || `No se pudo crear el curso (${res.status})`);
    }
    showSuccess('Curso creado.'); // PATCH: feedback amable
    return res.json().catch(() => null);
  };

  const updateCurso = async (curso) => {
    const id = curso.id;
    const res = await fetch(`${API_BASE}/CursoEscolar/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ fechaInicio: curso.fechaInicio, fechaFin: curso.fechaFin }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      throw new Error(msg || `No se pudo actualizar el curso (${res.status})`);
    }
    showSuccess('Curso actualizado.'); // PATCH
    return res.json().catch(() => null);
  };

  const fmtYMD = (v) => {
    if (!v) return "";
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return String(v).slice(0, 10);
  };

  const removeCurso = async ({ fechaInicio, fechaFin }) => {
    const fi = encodeURIComponent(fmtYMD(fechaInicio));
    const ff = encodeURIComponent(fmtYMD(fechaFin));
    const res = await fetch(`${API_BASE}/CursoEscolar/${fi}/${ff}`, { method: "DELETE" });
    if (!res.ok) {
      const msg = await readApiError(res);
      throw new Error(msg || `No se pudo eliminar el curso (${res.status})`);
    }
    showSuccess('Curso eliminado.'); // PATCH
  };

  React.useEffect(() => {
    const ctrl = new AbortController();
    loadCursos(ctrl.signal);
    return () => ctrl.abort();
  }, [loadCursos]);

  const openCreate = () => { setSelected(null); setDialogOpen(true); };
  const openEdit = (row) => { setSelected(row); setDialogOpen(true); };
  const closeDialog = () => setDialogOpen(false);

  const saveCurso = async (curso) => {
    try {
      const isEdit = Boolean(curso?.id);
      if (isEdit) await updateCurso(curso);
      else await createCurso(curso);
      await loadCursos();
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      setError(e?.message || "No se pudo guardar el curso");
      // PATCH: además de setError visual abajo, mostramos Snackbar
      showError(e?.message || "No se pudo guardar el curso");
    }
  };

  const deleteCurso = async (row) => {
    // tu eliminar estaba comentado; si lo activas, mejor usa un Dialog de confirmación
    try {
      await removeCurso({ fechaInicio: row.fechaInicio, fechaFin: row.fechaFin });
      await loadCursos();
    } catch (e) {
      console.error(e);
      setError(e?.message || "No se pudo eliminar el curso");
      showError(e?.message || "No se pudo eliminar el curso");
    }
  };

  const columns = [
    { field: "id", headerName: "ID", flex: 0.5, minWidth: 70, align: "center", headerAlign: "center", sortable: true },
    {
      field: "fechaInicio",
      headerName: "Inicio",
      flex: 1,
      minWidth: 120,
      align: "center",
      headerAlign: "center",
      sortable: true,
      renderCell: (params) => (params.value ? params.value.slice(0, 10) : ""),
    },
    {
      field: "fechaFin",
      headerName: "Fin",
      flex: 1,
      minWidth: 120,
      align: "center",
      headerAlign: "center",
      sortable: true,
      renderCell: (params) => (params.value ? params.value.slice(0, 10) : ""),
    },
    {
      field: "actions",
      headerName: "Acciones",
      flex: 0.8,
      minWidth: 120,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <>
          <Tooltip title="Editar">
            <IconButton
              size="small"
              color="primary"
              className="edit-bnt"
              onClick={(e) => { e.stopPropagation(); openEdit(params.row); }}
            >
              <EditRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {/* Eliminar opcional:
          <Tooltip title="Eliminar">
            <IconButton
              size="small"
              color="error"
              className="rmv-bnt"
              onClick={(e) => { e.stopPropagation(); deleteCurso(params.row); }}
            >
              <DeleteForeverRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip> */}
        </>
      ),
    },
  ];

  const columnVisibilityModel = React.useMemo(() => {
    if (isXs) {
      return { id: false, actions: true, fechaInicio: true, fechaFin: true };
    }
    if (isSm) {
      return { id: true, actions: true, fechaInicio: true, fechaFin: true };
    }
    return { id: true, actions: true, fechaInicio: true, fechaFin: true };
  }, [isXs, isSm]);

  return (
    <Paper sx={{ p: { xs: 1, md: 2 }, width: "100%" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => loadCursos()}
            size={isXs ? "small" : "medium"}
          >
            Refrescar
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<AddRoundedIcon />}
            onClick={openCreate}
            size={isXs ? "small" : "medium"}
          >
            Nuevo curso
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <div style={{ minWidth: 420 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            autoHeight
            density="compact"
            columnVisibilityModel={columnVisibilityModel}
            disableColumnMenu
            disableColumnFilter
            disableColumnResize
            disableColumnSorting
            disableRowSelectionOnClick
            pageSizeOptions={[5, 10, 25, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: isXs ? 5 : 10 } } }}
            sx={{
              "& .MuiDataGrid-columnHeaders": { bgcolor: "#282828" },
              "& .MuiDataGrid-columnHeadersInner": { bgcolor: "#282828" },
              "& .MuiDataGrid-columnHeader": { backgroundColor: "#282828" },
              "& .MuiDataGrid-filler": { backgroundColor: "#282828" },
              "& .MuiDataGrid-columnHeaderTitle": {
                fontWeight: 700,
                color: "#ffffff",
                fontSize: { xs: "0.8rem", sm: "0.9rem" },
              },
              "& .MuiDataGrid-cell": {
                borderColor: "#e5e7eb",
                fontSize: { xs: "0.8rem", sm: "0.9rem" },
                py: { xs: 0.5, sm: 1 },
              },
              "& .MuiDataGrid-row": {
                "&:nth-of-type(even)": { backgroundColor: "#f9fafb" },
                "&:hover": { backgroundColor: "#eef2ff" },
              },
              "& .MuiDataGrid-row.Mui-selected": {
                backgroundColor: "#dbeafe",
                "&:hover": { backgroundColor: "#bfdbfe" },
              },
              "& .MuiDataGrid-columnSeparator": { color: "#374151" },
              "& .MuiDataGrid-footerContainer": { bgcolor: "#f3f4f6" },
              "& .MuiIconButton-root": { color: "#2563eb" },
              ".edit-bnt": { color: "#ffc20e" },
              ".rmv-bnt": { color: "#e01f3d" },
              "& .MuiIconButton-root.Mui-error": { color: "#dc2626" },
              "--DataGrid-rowHeight": isXs ? "36px" : undefined,
              "--DataGrid-headerHeight": isXs ? "44px" : undefined,
            }}
          />
        </div>
      </Box>

      {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}

      <CursoEscolarDialog open={dialogOpen} onClose={closeDialog} initial={selected} onSave={saveCurso} />

      {/* PATCH: Snackbar global (no bloqueante) */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={handleSnackClose}>
        <Alert onClose={handleSnackClose} severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
