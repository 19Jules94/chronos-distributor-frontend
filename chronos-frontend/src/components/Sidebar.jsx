import React from "react";
import {
  Drawer, List, ListSubheader, ListItemButton, ListItemIcon,
  ListItemText, Divider, Toolbar, Box
} from "@mui/material";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";

const drawerWidth = 240;

// Modelo de menú (fácil de ampliar)
const MENU = [
  {
    key: "general",
    title: "General",
    items: [
      { key: "calendario", label: "Calendario", icon: <CalendarMonthRoundedIcon /> },     
    ],
  },
  {
    key: "usuarios",
    title: "Gestión de usuarios",
    items: [
      { key: "usuario-listar",  label: "Ver usuarios", icon: <GroupRoundedIcon /> },
    ],
  },
  {
    key: "turnos",
    title: "Turnos",
    items: [
      { key: "turno-gestion",   label: "Gestion de turnos",   icon: <AddCircleRoundedIcon   /> },
     
    ],
  },
];

export default function Sidebar({ activeKey, onSelect }) {
return (
  <Drawer
    variant="permanent"
    anchor="left"
    sx={{
      width: drawerWidth,
      flexShrink: 0,
      '& .MuiDrawer-paper': {
        width: drawerWidth,
        boxSizing: 'border-box',
        borderRight: '1px solid',
        borderColor: 'divider',
      },
    }}
  >
    <Toolbar />
    <Box sx={{ overflow: 'auto', py: 1 }}>
      {MENU.map((section, idx) => (
        <Box key={section.key}>
          <List
            dense
            subheader={
              <ListSubheader
                disableSticky
                sx={{
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  px: 2,
                  py: 1,
                }}
              >
                {section.title}
              </ListSubheader>
            }
          >
            {section.items.map((item) => (
              <ListItemButton
                key={item.key}
                selected={activeKey === item.key}
                onClick={() => onSelect?.(item.key)}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                    '&:hover': { bgcolor: 'action.selected' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: activeKey === item.key ? 600 : 400,
                  }}
                />
              </ListItemButton>
            ))}
          </List>
          {idx < MENU.length - 1 && <Divider sx={{ my: 1, opacity: 0.6 }} />}
        </Box>
      ))}
    </Box>
  </Drawer>
);
}
