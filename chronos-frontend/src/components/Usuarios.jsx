// Usuarios.jsx
import * as React from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
  Paper, Stack, Button, IconButton, Typography
} from "@mui/material";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import UsuarioEdit from "./Usuario-edit.jsx";

const initialRows = [
  { id: 1, nombre: "Ana", apellido1: "Gonzalez", apellido2: "Gonzalez", email: "ana@acme.com" },
  { id: 2, nombre: "Luis", apellido1: "Perez", apellido2: "Diaz", email: "luis@acme.com" },
];

export default function Usuarios() {
  const [rows, setRows] = React.useState(initialRows);
  const [editOpen, setEditOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState(null); // null = crear

  const openCreate = () => { setSelectedUser(null); setEditOpen(true); };
  const openEdit = (row) => { setSelectedUser(row); setEditOpen(true); };
  const closeDialog = () => setEditOpen(false);

  const saveUser = (user) => {
    if (user.id) {
      setRows(prev => prev.map(r => (r.id === user.id ? { ...r, ...user } : r)));
    } else {
      const nextId = Math.max(0, ...rows.map(r => r.id)) + 1;
      setRows(prev => [...prev, { ...user, id: nextId }]);
    }
    setEditOpen(false);
  };

  const deleteUser = (row) => {
    setRows(prev => prev.filter(r => r.id !== row.id));
  };

  const columns = [
    { field: "id", headerName: "ID", width: 120 },
    { field: "nombre", headerName: "Nombre", width: 160 },
    { field: "apellido1", headerName: "Apellido 1", width: 160 },
    { field: "apellido2", headerName: "Apellido 2", width: 160 },
    {
      field: "actions",
      headerName: "Acciones",
      sortable: false,
      width: 140,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <>
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => { e.stopPropagation(); openEdit(params.row); }}
          >
            <EditRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={(e) => { e.stopPropagation(); deleteUser(params.row); }}
          >
            <DeleteForeverRoundedIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 2, width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
      {/* Cabecera + botón añadir */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Usuarios</Typography>
        <Button variant="contained" startIcon={<PersonAddAlt1RoundedIcon />} onClick={openCreate}>
          Añadir usuario
        </Button>
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        disableRowSelectionOnClick
        pageSizeOptions={[5, 10, 25, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
        sx={{
          height: 480,
          maxWidth: "100%",
          overflow: "hidden",
          "& .MuiDataGrid-columnHeaders": {
            bgcolor: "primary.main",
            color: "primary.contrastText",
            borderBottom: "1px solid",
            borderColor: "primary.dark",
          },
          "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 700 },
          "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
        }}
      />

      {/* Modal de crear/editar */}
      <UsuarioEdit
        open={editOpen}
        user={selectedUser}
        onClose={closeDialog}
        onSave={saveUser}
      />
    </Paper>
  );
}
