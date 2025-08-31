// Usuario-edit.jsx
import * as React from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Stack, Select, MenuItem, InputLabel,FormControl 
} from "@mui/material";

export default function UsuarioEdit({ open, user, onClose, onSave }) {
    const [age, setAge] = React.useState('');
    const handleChangeSelect = (event) => {
        setAge(event.target.value);
    };
    const [form, setForm] = React.useState({
        nombre: "", apellido1: "", apellido2: "", email: ""
    });

    // Rellena el formulario cuando se abre o cambia el usuario
    React.useEffect(() => {
        setForm({
            nombre: user?.nombre || "",
            apellido1: user?.apellido1 || "",
            apellido2: user?.apellido2 || "",
            email: user?.email || "",
        });
    }, [user, open]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave?.({ ...user, ...form }); // devuelve el usuario editado/creado
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            disableScrollLock
            disablePortal
            keepMounted
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle>{user?.id ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogContent dividers>
                <Stack
                    id="user-form"
                    component="form"
                    onSubmit={handleSubmit}
                    spacing={2}
                    sx={{ mt: 1 }}
                >
                    <TextField name="nombre" label="Nombre" value={form.nombre} onChange={handleChange} required />
                    <TextField name="apellido1" label="Apellido 1" value={form.apellido1} onChange={handleChange} />
                    <TextField name="apellido2" label="Apellido 2" value={form.apellido2} onChange={handleChange} />
                    <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
                        <InputLabel id="demo-simple-select-standard-label">Age</InputLabel>
                        <Select
                            labelId="demo-simple-select-standard-label"
                            id="demo-simple-select-standard"
                            value={age}
                            onChange={handleChangeSelect}
                            label="Age"
                        >
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                            <MenuItem value={10}>Ten</MenuItem>
                            <MenuItem value={20}>Twenty</MenuItem>
                            <MenuItem value={30}>Thirty</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button type="submit" form="user-form" variant="contained">Guardar</Button>
            </DialogActions>
        </Dialog>
    );
}
