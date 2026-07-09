import React, { useState, useEffect } from "react";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import IconButton from "@material-ui/core/IconButton";
import Switch from "@material-ui/core/Switch";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import Divider from "@material-ui/core/Divider";

import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const describe = (a, tags) => {
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
  if (a.action === "template")
    return `Ao entrar → enviar template "${cfg.templateName || "?"}"`;
  if (a.action === "webhook") return "Ao entrar → chamar webhook";
  return `${a.trigger} / ${a.action}`;
};

// Painel reutilizável de automações de uma coluna (usado no modal de config).
const KanbanAutomationsPanel = ({ tagId, tags = [] }) => {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [trigger, setTrigger] = useState("on_enter");
  const [action, setAction] = useState("message");
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("pt_BR");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [idleDays, setIdleDays] = useState(3);
  const [targetTagId, setTargetTagId] = useState("");

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

  const buildPayload = () => {
    if (trigger === "idle") {
      if (!targetTagId) {
        toast.warn("Escolha a coluna de destino.");
        return null;
      }
      return {
        tagId,
        trigger: "idle",
        action: "move",
        config: { idleDays: Number(idleDays), targetTagId: Number(targetTagId) },
      };
    }
    if (action === "message") {
      if (!body.trim()) {
        toast.warn("Digite a mensagem.");
        return null;
      }
      return { tagId, trigger, action, config: { body: body.trim() } };
    }
    if (action === "template") {
      if (!templateName.trim()) {
        toast.warn("Informe o nome do template.");
        return null;
      }
      return {
        tagId,
        trigger,
        action,
        config: { templateName: templateName.trim(), languageCode },
      };
    }
    if (action === "webhook") {
      if (!/^https?:\/\//i.test(webhookUrl.trim())) {
        toast.warn("Informe uma URL de webhook válida.");
        return null;
      }
      return { tagId, trigger, action, config: { webhookUrl: webhookUrl.trim() } };
    }
    return null;
  };

  const handleAdd = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      await api.post("/kanban-automations", payload);
      toast.success("Automação criada!");
      setBody("");
      setTemplateName("");
      setWebhookUrl("");
      await fetchAutomations();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

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

  const otherTags = tags.filter((t) => String(t.id) !== String(tagId));

  return (
    <div>
      <Typography variant="subtitle2" gutterBottom>
        Automações ativas
      </Typography>
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
            style={{
              padding: 8,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
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
            <IconButton size="small" onClick={() => handleDelete(a.id)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Paper>
        ))
      )}

      <Divider style={{ margin: "16px 0" }} />

      <Typography variant="subtitle2" gutterBottom>
        Nova automação
      </Typography>

      <FormControl variant="outlined" margin="dense" fullWidth>
        <InputLabel>Quando</InputLabel>
        <Select value={trigger} onChange={(e) => setTrigger(e.target.value)} label="Quando">
          <MenuItem value="on_enter">Ao entrar na coluna</MenuItem>
          <MenuItem value="idle">Card parado X dias</MenuItem>
        </Select>
      </FormControl>

      {trigger === "on_enter" && (
        <FormControl variant="outlined" margin="dense" fullWidth>
          <InputLabel>Ação</InputLabel>
          <Select value={action} onChange={(e) => setAction(e.target.value)} label="Ação">
            <MenuItem value="message">Enviar mensagem</MenuItem>
            <MenuItem value="template">Enviar template</MenuItem>
            <MenuItem value="webhook">Chamar webhook (n8n/IA)</MenuItem>
          </Select>
        </FormControl>
      )}

      {trigger === "on_enter" && action === "message" && (
        <TextField
          label="Mensagem"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          variant="outlined"
          margin="dense"
          fullWidth
          multiline
          minRows={2}
          helperText="Use {{name}} para o nome do contato."
        />
      )}

      {trigger === "on_enter" && action === "template" && (
        <>
          <TextField
            label="Nome do template"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
          />
          <TextField
            label="Idioma"
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
          />
        </>
      )}

      {trigger === "on_enter" && action === "webhook" && (
        <TextField
          label="URL do webhook"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          variant="outlined"
          margin="dense"
          fullWidth
          placeholder="https://..."
        />
      )}

      {trigger === "idle" && (
        <>
          <TextField
            label="Dias parado"
            type="number"
            value={idleDays}
            onChange={(e) => setIdleDays(e.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
          />
          <FormControl variant="outlined" margin="dense" fullWidth>
            <InputLabel>Mover para</InputLabel>
            <Select
              value={targetTagId}
              onChange={(e) => setTargetTagId(e.target.value)}
              label="Mover para"
            >
              {otherTags.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="textSecondary">
            Ao mover, as automações "ao entrar" da coluna de destino são
            disparadas (permitindo alerta/mensagem).
          </Typography>
        </>
      )}

      <Button
        onClick={handleAdd}
        color="primary"
        variant="contained"
        disabled={saving}
        style={{ marginTop: 12 }}
      >
        Adicionar automação
      </Button>
    </div>
  );
};

export default KanbanAutomationsPanel;
