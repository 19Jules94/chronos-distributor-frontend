// src/components/Sidebar.jsx
import React from "react";
import {
  Drawer, List, ListSubheader, ListItemButton, ListItemIcon,
  ListItemText, Divider, Toolbar, Box, Avatar
} from "@mui/material";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import EditCalendarRoundedIcon from '@mui/icons-material/EditCalendarRounded';
const drawerWidth = 240;

// Color/acento para resaltar selección
const ACCENT = "#00bcd4"; // cian suave que combina con grafito

// Modelo de menú
const MENU = [
  {
    key: "general",
    title: "General",
    items: [
      { key: "calendario", label: "Calendario", icon: <CalendarMonthRoundedIcon sx={{ color: "white" }} /> },
    ],
  },
  {
    key: "usuarios",
    title: "Gestionar",
    items: [
      { key: "usuario-listar", label: "Usuarios", icon: <GroupRoundedIcon sx={{ color: "white" }} /> },
       { key: "turno-gestion", label: "Turnos", icon: <EditCalendarRoundedIcon sx={{ color: "white" }} /> },
        { key: "curso-gestion", label: "Cursos", icon: <SchoolRoundedIcon sx={{ color: "white" }} /> },
    ],
  },

];

export default function Sidebar({
  activeKey,
  onSelect,
  // En Vite, los assets en /public se sirven desde la raíz:
  // pon el logo como /logo.png (colócalo en /public/logo.png)
  logoSrc = "/logo.png",
  brand = "CHRONOS",
  onLogoClick,
}) {
  return (
    <Drawer
      variant="permanent"
      anchor="left"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderRight: "1px solid",
          borderColor: "divider",
          background: "#282828", // grafito
          color: "rgba(255,255,255,.92)",
        },
      }}
    >
      {/* Si usas AppBar, esto mantiene la separación */}
      <Toolbar sx={{ minHeight: 64 }} />

      {/* Branding (logo + marca) */}
      <Box
        onClick={onLogoClick}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          px: 2,
          pb: 1,
          cursor: onLogoClick ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        {logoSrc ? (
          <Box
            component="img"
            src={logoSrc}
          
            sx={{ height: 180, width: "auto", display: "block" }}
          />
        ) : (
          <Avatar
            variant="rounded"
            sx={{
              width: 54,
              height: 54,
              fontWeight: 800,
              bgcolor: ACCENT,
              color: "#0b0f12",
              letterSpacing: ".04em",
            }}
          >
            {String(brand).slice(0, 2).toUpperCase()}
          </Avatar>
        )}
      </Box>

     

      {/* Menú */}
      <Box sx={{ overflow: "auto", py: 1 }}>
        {MENU.map((section, idx) => (
          <Box key={section.key}>
            {section.title && (
              <List
                dense
                subheader={
                  <ListSubheader
                    disableSticky
                    sx={{
                      bgcolor: "transparent",
                      fontWeight: 800,
                      fontSize: "0.76rem",
                      color: "rgba(255,255,255,.72)",
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      px: 2,
                      py: 1,
                    }}
                  >
                    {section.title}
                  </ListSubheader>
                }
              >
                {section.items.map((item) => {
                  const selected = activeKey === item.key;
                  return (
                    <ListItemButton
                      key={item.key}
                      selected={selected}
                      onClick={() => onSelect?.(item.key)}
                      sx={{
                        mx: 1,
                        mb: 0.5,
                        borderRadius: 1,
                        position: "relative",
                        color: "rgba(255,255,255,.92)",
                        "& .MuiListItemIcon-root": {
                          color: "rgba(255,255,255,.92)",
                        },
                        "&:hover": { bgcolor: "rgba(255,255,255,.06)" },
                        "&.Mui-selected": {
                          bgcolor: "rgba(255,255,255,.10)",
                          "&:hover": { bgcolor: "rgba(255,255,255,.12)" },
                        },
                        "&.Mui-selected::before": {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: 6,
                          bottom: 6,
                          width: 3,
                          borderRadius: 1,
                          backgroundColor: ACCENT,
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontWeight: selected ? 800 : 600,
                          letterSpacing: ".02em",
                          color: "inherit",
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}

            {idx < MENU.length - 1 && (
              <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.12)" }} />
            )}
          </Box>
        ))}
      </Box>
    </Drawer>
  );
}
