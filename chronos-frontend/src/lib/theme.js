// src/theme.js
import { createTheme } from "@mui/material/styles";
import "@fontsource/quicksand"; // incluye todos los grosores por defecto

const theme = createTheme({
  typography: {
    fontFamily: "Quicksand, sans-serif",
  },
  // puedes definir otros ajustes si quieres
  palette: {
    mode: "light", // o "dark"
    primary: {
      main: "#00bcd4", // el acento que usas
    },
    background: {
      default: "#f5f5f5",
    },
  },
});

export default theme;
