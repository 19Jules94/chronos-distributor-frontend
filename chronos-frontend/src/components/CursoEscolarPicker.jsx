// src/components/CursoEscolarPicker.jsx
import React from 'react';
import {
  Stack, FormControl, InputLabel, Select, MenuItem,   
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
  cursos, cursoActualId, onChangeCurso,
}) {


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
      </Stack>

      
    </>
  );
}
