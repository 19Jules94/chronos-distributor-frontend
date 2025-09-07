import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, FormControl, InputLabel, Select, MenuItem, Typography
} from "@mui/material";

export default function UsuarioEdit({
  open,
  user,
  onClose,
  onSave,
  totalUsuarios = 9,
  availableTurnos = [],
  cursoSeleccionado, // opcional, solo informativo en modo crear
}) {
  const isEdit = Boolean(user?.id);

  const [form, setForm] = React.useState({
    nombre: "",
    apellido1: "",
    apellido2: "",
    turnoAsignado: null,
  });

  React.useEffect(() => {
    setForm({
      nombre: user?.nombre ?? "",
      apellido1: user?.apellido1 ?? "",
      apellido2: user?.apellido2 ?? "",
      turnoAsignado: user?.turnoAsignado ?? null,
    });
  }, [user, open]);

  const maxTurno = React.useMemo(() => {
    const n = Number(totalUsuarios);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 9;
  }, [totalUsuarios]);

  const currentTurno = React.useMemo(() => {
    const n = Number(form.turnoAsignado);
    return Number.isFinite(n) ? n : null;
  }, [form.turnoAsignado]);

  const opcionesTurno = React.useMemo(() => {
    const base = Array.from({ length: maxTurno }, (_, i) => i + 1);

    let set = new Set();
    if (Array.isArray(availableTurnos) && availableTurnos.length > 0) {
      availableTurnos.forEach((t) => {
        const n = Number(t);
        if (Number.isFinite(n) && n >= 1 && n <= maxTurno) set.add(n);
      });
    } else {
      base.forEach((n) => set.add(n));
    }

    if (isEdit && Number.isFinite(currentTurno) && currentTurno >= 1 && currentTurno <= maxTurno) {
      set.add(currentTurno);
    }

    return Array.from(set).sort((a, b) => a - b);
  }, [availableTurnos, maxTurno, isEdit, currentTurno]);

  const sinOpciones = opcionesTurno.length === 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "turnoAsignado"
          ? (value === "" ? null : Number(value))
          : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...user, ...form };
    if (!isEdit) delete payload.turnoAsignado; // alta: sin turno
    onSave?.(payload);
  };

  const mostrarAvisoSinOpciones = isEdit && sinOpciones;

  return (
    <Dialog
      id="usuario-edit-dialog"
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      keepMounted
      disableEnforceFocus
      disableRestoreFocus
    >
      <DialogTitle>{isEdit ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>

      <DialogContent dividers>
        {!isEdit && cursoSeleccionado?.fechaInicio && cursoSeleccionado?.fechaFin && (
          <Typography variant="caption" sx={{ mb: 1, display: "block", color: "text.secondary" }}>
            El usuario se creará dentro del curso:{" "}
            {String(cursoSeleccionado.fechaInicio).slice(0,10)} — {String(cursoSeleccionado.fechaFin).slice(0,10)}
          </Typography>
        )}

        <Stack
          id="user-form"
          component="form"
          onSubmit={handleSubmit}
          spacing={2}
          sx={{ mt: 1 }}
        >
          <TextField
            name="nombre"
            label="Nombre"
            value={form.nombre}
            onChange={handleChange}
            required
            fullWidth
            autoFocus
          />
          <TextField
            name="apellido1"
            label="Apellido 1"
            value={form.apellido1}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            name="apellido2"
            label="Apellido 2"
            value={form.apellido2}
            onChange={handleChange}
            fullWidth
          />

          {isEdit ? (
            <FormControl fullWidth>
              <InputLabel id="turno-label">Turno Asignado</InputLabel>
              <Select
                labelId="turno-label"
                id="turno-asignado"
                name="turnoAsignado"
                label="Turno Asignado"
                value={form.turnoAsignado ?? ""}
                onChange={handleChange}
                disabled={sinOpciones}
                renderValue={(val) => {
                  if (val === "" || val === null) return "Ninguno";
                  return String(val);
                }}
                MenuProps={{
                  // Ayuda a que el menú no “secuestren” el foco en Electron
                  disablePortal: true,
                  keepMounted: true,
                  disableScrollLock: true,
                  // container: () => document.getElementById('usuario-edit-dialog'), // opcional
                }}
              >
                <MenuItem value="">
                  <em>Ninguno</em>
                </MenuItem>

                {sinOpciones ? (
                  <MenuItem value="_no_free_" disabled>
                    <em>Todos los turnos están asignados</em>
                  </MenuItem>
                ) : (
                  opcionesTurno.map((n) => (
                    <MenuItem key={n} value={n}>{n}</MenuItem>
                  ))
                )}
              </Select>

              <Typography variant="caption" sx={{ mt: 0.5, color: "text.secondary" }}>
                Rango: 1–{maxTurno}
                {Array.isArray(availableTurnos) && availableTurnos.length > 0
                  ? " · mostrando turnos libres"
                  : " · mostrando todos los turnos"}
              </Typography>

              {mostrarAvisoSinOpciones && (
                <Typography variant="caption" sx={{ mt: 0.5, color: "error.main" }}>
                  No hay turnos libres ahora mismo.
                </Typography>
              )}
            </FormControl>
          ) : (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              El turno se asignará más adelante. Crea primero el usuario y después edítalo para asignarle su número
              (1–{maxTurno}).
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="user-form" variant="contained">
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
