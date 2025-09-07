import * as React from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Paper, Typography, Dialog, DialogTitle, DialogContent } from "@mui/material";
import API_BASE from '../lib/apiBase.js';

export default function CountTurnos({ open, onClose, cursoId, turnoAsignado, usuarioId, nombre }) {
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

        const res = await fetch(
          `${API_BASE}/Turnos/resumen-turno-usuario?cursoId=${cursoId}`,
          { headers: { accept: "application/json" }, signal: ctrl.signal }
        );
        if (!res.ok) throw new Error(`GET resumen-turno-usuario -> ${res.status}`);

        const json = await res.json();
        const raw = Array.isArray(json?.data) ? json.data : [];

        // Normalización de filas: tipado y nombre compuesto
        const norm = raw.map((r, i) => {
          const turnoNum = r?.turnoAsignado != null ? Number(r.turnoAsignado) : null;

          const nombreCompuesto =
            r?.nombre
            ?? [r?.firstName, r?.apellido1, r?.lastName, r?.apellido2]
                .filter(Boolean)
                .join(" ")
                .trim()
            ?? "";

          return {
            id: r?.id ?? r?.usuarioId ?? r?.userId ?? i + 1,
            turnoAsignado: Number.isFinite(turnoNum) ? turnoNum : null,
            usuarioId: r?.usuarioId ?? r?.userId ?? r?.id ?? null,
            nombre: nombre || null,
            lunes: r?.lunes ?? 0,
            martes: r?.martes ?? 0,
            miercoles: r?.miercoles ?? 0,
            jueves: r?.jueves ?? 0,
            viernes: r?.viernes ?? 0,
            domingoFestivo: r?.domingoFestivo ?? 0,
            total: r?.total ?? (
              (r?.lunes ?? 0) + (r?.martes ?? 0) + (r?.miercoles ?? 0) +
              (r?.jueves ?? 0) + (r?.viernes ?? 0) + (r?.domingoFestivo ?? 0)
            ),
            // Guarda también originales por si necesitas depurar:
            __raw: r,
          };
        });

        // Filtrado robusto por turnoAsignado o usuarioId
        const ta = turnoAsignado != null ? Number(turnoAsignado) : null;
        const uid = usuarioId != null ? String(usuarioId) : null;

        let row = null;
        if (ta != null && Number.isFinite(ta)) {
          row = norm.find(r => Number(r.turnoAsignado) === ta) || null;
        }
        if (!row && uid) {
          row =
            norm.find(r => {
              const rUid = r?.usuarioId != null ? String(r.usuarioId) : null;
              return rUid && rUid === uid;
            }) || null;
        }

        const finalRows = row ? [row] : norm;
        setRows(finalRows);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || "Error cargando resumen");
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [open, cursoId, turnoAsignado, usuarioId]);

  const columns = [
    { field: "turnoAsignado", headerName: "Turno Nº", width: 100 },
    { field: "nombre", headerName: "Nombre", flex: 1, minWidth: 180 },
    { field: "lunes", headerName: "LUNES", width: 90 },
    { field: "martes", headerName: "MARTES", width: 90 },
    { field: "miercoles", headerName: "MIERCOLES", width: 100 },
    { field: "jueves", headerName: "JUEVES", width: 90 },
    { field: "viernes", headerName: "VIERNES", width: 90 },
    { field: "domingoFestivo", headerName: "DOM /FEST", width: 110 },
    { field: "total", headerName: "Total", width: 90 },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {nombre ? `Turnos de ${nombre}` : "Resumen de turnos"}
      </DialogTitle>
      <DialogContent>
        <Paper sx={{ p: 1 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[5, 10, 25]}
            initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
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
