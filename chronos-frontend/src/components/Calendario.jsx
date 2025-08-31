import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';

const Calen = () => {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, multiMonthPlugin]}
      initialView="multiMonthYear"
      weekends={false}
      events={[
        { title: 'Reunión', date: '2025-08-30' },
        { title: 'Conferencia', date: '2025-09-01' }
      ]}
    />
  );
};

export default Calen;
