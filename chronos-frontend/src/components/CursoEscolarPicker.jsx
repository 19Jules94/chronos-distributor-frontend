// src/components/CursoEscolarPicker.jsx
import React from 'react';
import {
  Stack, FormControl, InputLabel, Select, MenuItem, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';

function labelCurso(c) {
  // Etiqueta "YYYY-YYYY" tomando años de inicio y fin
  if (!c?.fechaInicio || !c?.fechaFin) return 'Curso';
  const y1 = Number(c.fechaInicio.slice(0, 4));
  const y2 = Number(c.fechaFin.slice(0, 4));
  return `${y1}-${y2}`;
}

export default function CursoEscolarPicker({
  cursos, cursoActualId, onChangeCurso, onCreateCurso
}) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ fechaInicio: '', fechaFin: '' });

  const handleOpen = () => setOpen(true);
  const handleClose = () => { setOpen(false); setForm({ fechaInicio: '', fechaFin: '' }); };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.fechaInicio || !form.fechaFin) return;
    if (form.fechaInicio > form.fechaFin) {
      alert('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }
    onCreateCurso?.(form).then(ok => {
      if (ok !== false) handleClose();
    });
  };

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="curso-picker-label">Curso escolar</InputLabel>
          <Select
            labelId="curso-picker-label"
            value={cursoActualId ?? ''}
            label="Curso escolar"
            onChange={(e) => onChangeCurso?.(Number(e.target.value))}
          >
            {cursos.map(c => (
              <MenuItem key={c.id} value={c.id}>{labelCurso(c)} · {c.fechaInicio} → {c.fechaFin}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          size="small"
          variant="outlined"
          startIcon={<AddCircleOutlineRoundedIcon />}
          onClick={handleOpen}
        >
          Nuevo curso
        </Button>
      </Stack>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>Crear curso escolar</DialogTitle>
        <DialogContent dividers>
          <Stack component="form" id="curso-form" onSubmit={handleCreate} spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Fecha inicio"
              type="date"
              value={form.fechaInicio}
              onChange={(e) => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="Fecha fin"
              type="date"
              value={form.fechaFin}
              onChange={(e) => setForm(f => ({ ...f, fechaFin: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button type="submit" form="curso-form" variant="contained">Crear</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
