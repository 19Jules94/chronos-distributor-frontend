import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import {
  Stack, Button, Typography,Paper
} from "@mui/material";

const CalenEdit = () => {
  return (
    <Paper sx={{ p: 2, width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Usuarios</Typography>
        <Button variant="contained" startIcon={<EventRepeatRoundedIcon />}>
          Generar Horario
        </Button>
      </Stack>
      <FullCalendar
        plugins={[dayGridPlugin, multiMonthPlugin]}
        initialView="multiMonthYear"
        weekends={false}
        events={[
          { title: 'Reunión', date: '2025-08-30' },
          { title: 'Conferencia', date: '2025-09-01' }
        ]}
      />
    </Paper>

  );
};

export default CalenEdit;
