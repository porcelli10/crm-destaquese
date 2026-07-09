import React, { useState, useEffect } from "react";

import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import IconButton from "@material-ui/core/IconButton";
import Switch from "@material-ui/core/Switch";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";

import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import AutomationBuilderModal from "../AutomationBuilderModal";

// Descrição curta de uma automação (novo schema ou legado).
const describe = (a, tags) => {
  if (a.name) return a.name;
  let cfg = {};
  try {
    cfg = a.config ? JSON.parse(a.config) : {};
  } catch (e) {
    cfg = {};
  }
  if (a.trigger === "idle") {
    const target = tags.find((t) => String(t.id) === String(cfg.targetTagId));
    return `Parado ${cfg.idleDays || "?"} dia(s) → mover para "${
      target?.name || "?"
    }"`;
  }
  if (a.action === "message") return "Ao entrar → enviar mensagem";
  if (a.action === "template") return `Ao entrar → template "${cfg.templateName || "?"}"`;
  if (a.action === "webhook") return "Ao entrar → webhook";
  return "Automação";
};

const KanbanAutomationsPanel = ({ tagId, tags = [] }) => {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchAutomations = async () => {
    if (!tagId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/kanban-automations?tagId=${tagId}`);
      setAutomations(data || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/kanban-automations/${id}`);
      await fetchAutomations();
    } catch (err) {
      toastError(err);
    }
  };

  const handleToggle = async (a) => {
    try {
      await api.put(`/kanban-automations/${a.id}`, { active: !a.active });
      await fetchAutomations();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle2">Automações da coluna</Typography>
        <Button
          color="primary"
          variant="contained"
          size="small"
          onClick={() => {
            setEditing(null);
            setBuilderOpen(true);
          }}
        >
          + Nova Automação
        </Button>
      </div>

      <div style={{ marginTop: 8 }}>
        {loading ? (
          <Typography variant="body2" color="textSecondary">
            Carregando...
          </Typography>
        ) : automations.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Nenhuma automação nesta coluna ainda.
          </Typography>
        ) : (
          automations.map((a) => (
            <Paper
              key={a.id}
              variant="outlined"
              style={{ padding: 8, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}
            >
              <Switch
                size="small"
                color="primary"
                checked={!!a.active}
                onChange={() => handleToggle(a)}
              />
              <Typography variant="body2" style={{ flex: 1 }}>
                {describe(a, tags)}
              </Typography>
              <IconButton
                size="small"
                title="Editar"
                onClick={() => {
                  setEditing(a);
                  setBuilderOpen(true);
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" title="Excluir" onClick={() => handleDelete(a.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))
        )}
      </div>

      <AutomationBuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        tagId={tagId}
        tags={tags}
        automation={editing}
        onSaved={() => {
          fetchAutomations();
          toast.success("Lista atualizada");
        }}
      />
    </div>
  );
};

export default KanbanAutomationsPanel;
