import * as React from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Paper, Typography, Dialog, DialogTitle, DialogContent } from "@mui/material";
import API_BASE from '../lib/apiBase.js';



export default function CountTurnosTotales({ open, onClose, cursoId }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!open || !cursoId) return;
    const ctrl = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/Turnos/resumen-turno-usuario?cursoId=${cursoId}`, {
          headers: { accept: "application/json" },
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`GET resumen-turno-usuario -> ${res.status}`);

        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];

        // Normaliza: id = turnoAsignado
        const normalized = data
          .map((r) => ({
            id: r.turnoAsignado,
            turnoAsignado: r.turnoAsignado,
            lunes: r.lunes ?? 0,
            martes: r.martes ?? 0,
            miercoles: r.miercoles ?? 0,
            jueves: r.jueves ?? 0,
            viernes: r.viernes ?? 0,
            domingoFestivo: r.domingoFestivo ?? 0,
            total: r.total ?? 0,
          }))
          .sort((a, b) => a.turnoAsignado - b.turnoAsignado);

        setRows(normalized);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || "Error cargando resumen");
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [open, cursoId]);

  const columns = [
    { field: "turnoAsignado", headerName: "Turno", width: 104, align: "center", headerAlign: "center" },
    { field: "lunes", headerName: "LUNES", width: 104, align: "center", headerAlign: "center" },
    { field: "martes", headerName: "MARTES", width: 104, align: "center", headerAlign: "center" },
    { field: "miercoles", headerName: "MIÉRCOLES", width: 104, align: "center", headerAlign: "center" },
    { field: "jueves", headerName: "JUEVES", width: 104, align: "center", headerAlign: "center" },
    { field: "viernes", headerName: "VIERNES", width: 104, align: "center", headerAlign: "center" },
    { field: "domingoFestivo", headerName: "DOM/FEST", width: 104, align: "center", headerAlign: "center" },
    { field: "total", headerName: "TOTAL", width: 106, align: "center", headerAlign: "center" },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>      
      <DialogContent>
        <Paper sx={{ p: 1 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
             disableColumnMenu
             disableColumnFilter
             disableColumnResize
             disableColumnSorting
            disableRowSelectionOnClick
            pageSizeOptions={[9, 18, 27]}
            initialState={{
              pagination: { paginationModel: { pageSize: 9 } },
              sorting: { sortModel: [{ field: "turnoAsignado", sort: "asc" }] },
            }}
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
          "& .MuiDataGrid-cell": { borderColor: "#e5e7eb" },
          "& .MuiDataGrid-columnSeparator": { color: "#374151" },
          "& .MuiDataGrid-footerContainer": { bgcolor: "#f3f4f6" },
          "& .MuiIconButton-root": { color: "#2563eb" },
          ".edit-bnt": { color: "#ffc20e" },
          ".rmv-bnt": { color: "#e01f3d" },
          "& .MuiIconButton-root.Mui-error": { color: "#dc2626" },
        }}
          />
          {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
        </Paper>
      </DialogContent>
    </Dialog>
  );
}
