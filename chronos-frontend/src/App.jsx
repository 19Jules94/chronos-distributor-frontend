import React, { useState, Suspense } from "react";
import { AppBar, Toolbar, Typography, Box, Paper } from "@mui/material";
import Sidebar from "./components/Sidebar.jsx";
import Calen from "./components/Calendario.jsx";
import CalenEdit from "./components/Calendario-edit.jsx";

// Carga perezosa de vistas (opcional pero recomendado)
const Usuarios = React.lazy(() => import("./components/Usuarios.jsx"));
const Calendario = React.lazy(() => import("./components/Calendario.jsx"));
const CalendarioEdit = React.lazy(() => import("./components/Calendario-edit.jsx"));

export default function App() {
  const [active, setActive] = useState("calendario");
  const renderContent = () => {
 
    switch (active) {

      case "usuario-listar":
        return (
          <Suspense>
            <Usuarios />
          </Suspense>
        )
      case "calendario":
        return (
          <Suspense>
            <Calendario />
          </Suspense>
        )
      case "turno-gestion":
        return (
          <Suspense>
            <CalendarioEdit />
          </Suspense>
        )
      
      default:
        return <Paper sx={{ p: 3 }}>Bienvenido 👋</Paper>;
    }

  }
   return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar><Typography variant="h6">Chronos</Typography></Toolbar>
      </AppBar>

      {/* 3) Pasas estado y setter al Sidebar */}
      <Sidebar activeKey={active} onSelect={setActive} />

      {/* 4) Pintas lo que toque */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {renderContent()}
      </Box>
    </Box>
  );
}