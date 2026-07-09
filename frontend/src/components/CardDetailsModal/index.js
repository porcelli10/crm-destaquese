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
import Chip from "@material-ui/core/Chip";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import SaveOutlinedIcon from "@material-ui/icons/SaveOutlined";

import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const CHANNEL_LABEL = {
  iasolution: "iaSolution",
  official: "Oficial",
  baileys: "WhatsApp",
  hub: "Hub",
};

const formatBRL = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatSchedule = (s) =>
  s
    ? new Date(s).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const Row = ({ label, children }) => (
  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
    <span style={{ color: "#888", minWidth: 110 }}>{label}:</span>
    <span style={{ flex: 1 }}>{children}</span>
  </div>
);

const CardDetailsModal = ({ open, onClose, ticket, onChanged, onOpenTicket }) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  const ticketId = ticket?.id;

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

  const notify = () => onChanged && onChanged();

  const handleSaveField = async (field) => {
    try {
      await api.post(`/ticket-custom-fields/${ticketId}`, {
        name: field.name,
        value: field.value,
      });
      toast.success("Campo salvo!");
      notify();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/ticket-custom-fields/${id}`);
      setFields((prev) => prev.filter((f) => f.id !== id));
      notify();
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
      notify();
    } catch (err) {
      toastError(err);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{ticket.contact?.name || "Card"}</DialogTitle>
      <DialogContent dividers>
        {/* Resumo */}
        <div style={{ fontSize: "0.9rem" }}>
          <Row label="Número">{ticket.contact?.number}</Row>
          <Row label="Valor">
            <b style={{ color: "#159F5B" }}>{formatBRL(ticket.value)}</b>
          </Row>
          <Row label="Responsável">{ticket.user?.name || "Sem responsável"}</Row>
          <Row label="Fila">{ticket.queue?.name || "—"}</Row>
          <Row label="Canal">
            {CHANNEL_LABEL[ticket.whatsapp?.channel] || ticket.whatsapp?.channel || "—"}
          </Row>
          {ticket.nextSchedule && (
            <Row label="Agendamento">{formatSchedule(ticket.nextSchedule.sendAt)}</Row>
          )}
          {(ticket.tags || []).length > 0 && (
            <Row label="Tags">
              {ticket.tags.map((t) => (
                <Chip
                  key={t.id}
                  size="small"
                  label={t.name}
                  style={{
                    height: 20,
                    marginRight: 4,
                    background: t.color || "#999",
                    color: "#fff",
                  }}
                />
              ))}
            </Row>
          )}
        </div>

        <Divider style={{ margin: "14px 0" }} />

        {/* Campos personalizados */}
        <Typography variant="subtitle2" gutterBottom>
          Campos personalizados
        </Typography>
        {loading ? (
          <Typography variant="body2" color="textSecondary">
            Carregando...
          </Typography>
        ) : fields.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Nenhum campo ainda.
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
                onChange={(e) =>
                  setFields((prev) =>
                    prev.map((x) => (x.id === f.id ? { ...x, value: e.target.value } : x))
                  )
                }
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
          Adicionar informação
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
        <Button onClick={handleAdd} color="primary" variant="contained" style={{ marginTop: 8 }}>
          Adicionar
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onOpenTicket && onOpenTicket(ticket.uuid)} color="primary">
          Abrir atendimento
        </Button>
        <Button onClick={onClose} color="secondary">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CardDetailsModal;
