import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, FormControl, InputLabel, Select, MenuItem, Typography
} from "@mui/material";

export default function UsuarioEdit({ open, user, onClose, onSave }) {
  const isEdit = Boolean(user?.id);

  // Estado del formulario (incluye turnoAsignado solo si edito)
  const [form, setForm] = React.useState({
    nombre: "",
    apellido1: "",
    apellido2: "",
    turnoAsignado: null, // number | null
  });

  // Precarga cuando se abre y cambia el usuario
  React.useEffect(() => {
    setForm({
      nombre:        user?.nombre ?? "",
      apellido1:     user?.apellido1 ?? "",
      apellido2:     user?.apellido2 ?? "",
      turnoAsignado: user?.turnoAsignado ?? null,
    });
  }, [user, open]);

  // Handler genérico
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
    // Payload base
    const payload = { ...user, ...form };

    // Si es CREAR, no mandamos turnoAsignado (se asignará después)
    if (!isEdit) {
      delete payload.turnoAsignado;
    }

    onSave?.(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>

      <DialogContent dividers>
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

          {/* Solo en EDICIÓN mostramos el selector de turno */}
          {isEdit ? (
            <FormControl fullWidth>
              <InputLabel id="turno-label">Turno Asignado</InputLabel>
              <Select
                labelId="turno-label"
                id="turno-asignado"
                name="turnoAsignado"
                label="Turno Asignado"
                value={form.turnoAsignado ?? ""}   // '' muestra "Ninguno"
                onChange={handleChange}
              >
                <MenuItem value="">
                  <em>Ninguno</em>
                </MenuItem>
                {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
                  <MenuItem key={n} value={n}>{n}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              El turno se asignará más adelante. Crea primero el usuario y después edítalo para asignarle su número.
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
