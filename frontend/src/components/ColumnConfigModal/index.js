import React, { useState, useEffect } from "react";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Typography from "@material-ui/core/Typography";

import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import KanbanAutomationsPanel from "../KanbanAutomationsPanel";

const ColumnConfigModal = ({ open, onClose, tag, tags = [], onChanged }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#682EE3");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && tag) {
      setTabIndex(0);
      setName(tag.name || "");
      setColor(tag.color || "#682EE3");
    }
  }, [open, tag]);

  const handleSaveGeneral = async () => {
    if (!name.trim()) {
      toast.warn("Informe o nome da coluna.");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/tags/${tag.id}`, { name: name.trim(), color, kanban: 1 });
      toast.success("Coluna atualizada!");
      if (onChanged) onChanged();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteColumn = async () => {
    if (!window.confirm("Excluir esta coluna? Os cards perdem esta etapa.")) return;
    try {
      await api.delete(`/tags/${tag.id}`);
      toast.success("Coluna excluída.");
      if (onChanged) onChanged();
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  if (!tag) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Configurações da Coluna</DialogTitle>
      <Tabs
        value={tabIndex}
        onChange={(e, v) => setTabIndex(v)}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Configurações Gerais" />
        <Tab label="Automações" />
        <Tab label="Integrações" />
      </Tabs>
      <DialogContent dividers>
        {tabIndex === 0 && (
          <div>
            <TextField
              label="Nome da Coluna"
              value={name}
              onChange={(e) => setName(e.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
            />
            <TextField
              label="Cor"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              variant="outlined"
              margin="dense"
              style={{ width: 100 }}
            />
            <div style={{ marginTop: 16 }}>
              <Button color="secondary" onClick={handleDeleteColumn}>
                Excluir coluna
              </Button>
            </div>
          </div>
        )}

        {tabIndex === 1 && (
          <KanbanAutomationsPanel tagId={tag.id} tags={tags} />
        )}

        {tabIndex === 2 && (
          <Typography variant="body2" color="textSecondary">
            As integrações da coluna (cadência de tarefas, webhooks dedicados)
            entrarão aqui em breve. Por enquanto, use as automações do tipo
            "webhook" na aba Automações.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Fechar
        </Button>
        {tabIndex === 0 && (
          <Button
            onClick={handleSaveGeneral}
            color="primary"
            variant="contained"
            disabled={saving}
          >
            Salvar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ColumnConfigModal;
