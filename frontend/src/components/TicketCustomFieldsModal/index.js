import React, { useState, useEffect } from "react";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import SaveOutlinedIcon from "@material-ui/icons/SaveOutlined";

import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const TicketCustomFieldsModal = ({
  open,
  onClose,
  ticketId,
  ticketName,
  onSaved,
}) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  const fetchFields = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/ticket-custom-fields/${ticketId}`);
      setFields(data || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setNewName("");
      setNewValue("");
      fetchFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticketId]);

  const notifySaved = () => {
    if (onSaved) onSaved();
  };

  const handleChangeValue = (id, value) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, value } : f)));
  };

  const handleSaveField = async (field) => {
    try {
      await api.post(`/ticket-custom-fields/${ticketId}`, {
        name: field.name,
        value: field.value,
      });
      toast.success("Campo salvo!");
      notifySaved();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/ticket-custom-fields/${id}`);
      setFields((prev) => prev.filter((f) => f.id !== id));
      notifySaved();
    } catch (err) {
      toastError(err);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.warn("Informe o nome do campo.");
      return;
    }
    try {
      await api.post(`/ticket-custom-fields/${ticketId}`, {
        name: newName.trim(),
        value: newValue,
      });
      setNewName("");
      setNewValue("");
      await fetchFields();
      notifySaved();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Campos personalizados{ticketName ? ` · ${ticketName}` : ""}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Typography variant="body2" color="textSecondary">
            Carregando...
          </Typography>
        ) : fields.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Nenhum campo neste card ainda.
          </Typography>
        ) : (
          fields.map((f) => (
            <div
              key={f.id}
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
            >
              <TextField
                label={f.name}
                value={f.value || ""}
                onChange={(e) => handleChangeValue(f.id, e.target.value)}
                variant="outlined"
                margin="dense"
                fullWidth
              />
              <IconButton size="small" title="Salvar" onClick={() => handleSaveField(f)}>
                <SaveOutlinedIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" title="Remover" onClick={() => handleDelete(f.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </div>
          ))
        )}

        <Divider style={{ margin: "12px 0" }} />

        <Typography variant="subtitle2" gutterBottom>
          Novo campo
        </Typography>
        <div style={{ display: "flex", gap: 8 }}>
          <TextField
            label="Nome"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            variant="outlined"
            margin="dense"
            style={{ flex: 1 }}
          />
          <TextField
            label="Valor"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            variant="outlined"
            margin="dense"
            style={{ flex: 1 }}
          />
        </div>
        <Button
          onClick={handleAdd}
          color="primary"
          variant="contained"
          style={{ marginTop: 8 }}
        >
          Adicionar campo
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TicketCustomFieldsModal;
