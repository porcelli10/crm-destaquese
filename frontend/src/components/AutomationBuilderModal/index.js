import React, { useState, useEffect } from "react";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import Divider from "@material-ui/core/Divider";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const TRIGGER_TYPES = [
  { value: "on_enter", label: "Entrada no Card" },
  { value: "on_leave", label: "Saída do Card" },
  { value: "idle_column", label: "Tempo na Coluna" },
  { value: "recurring", label: "Execução recorrente", soon: true },
  { value: "recurring_column", label: "Tempo Recorrente na Coluna", soon: true },
  { value: "message_received", label: "Mensagem Recebida", soon: true },
  { value: "no_interaction", label: "Sem Interação" },
];

const ACTION_TYPES = [
  { value: "message", label: "Enviar Mensagem" },
  { value: "template", label: "Enviar Template de Mensagem" },
  { value: "funnel", label: "Enviar Funil", soon: true },
  { value: "creative", label: "Enviar Criativo", soon: true },
  { value: "move_column", label: "Mudar de Coluna" },
  { value: "add_tag", label: "Adicionar Tag" },
  { value: "remove_tag", label: "Remover Tag" },
  { value: "ai_link", label: "Vincular Agente de IA", soon: true },
  { value: "ai_unlink", label: "Remover Agente de IA", soon: true },
  { value: "assign_user", label: "Vincular Responsável" },
  { value: "create_activity", label: "Criar Atividade" },
  { value: "delay", label: "Aguardar (Delay)" },
  { value: "duplicate", label: "Duplicar Negócio", soon: true },
  { value: "conversion", label: "Disparar Conversão", soon: true },
];

const isTimeTrigger = (t) =>
  ["idle_column", "no_interaction", "recurring_column"].includes(t);

const AutomationBuilderModal = ({
  open,
  onClose,
  tagId,
  tags = [],
  automation,
  onSaved,
}) => {
  const [active, setActive] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [retroactive, setRetroactive] = useState(false);
  const [intervalActive, setIntervalActive] = useState(true);
  const [intervalValue, setIntervalValue] = useState(30);
  const [intervalUnit, setIntervalUnit] = useState("segundos");
  const [respectBusinessHours, setRespectBusinessHours] = useState(false);
  const [triggers, setTriggers] = useState([{ type: "on_enter" }]);
  const [actions, setActions] = useState([{ type: "message", body: "" }]);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // usuários para "Vincular Responsável"
    api
      .get("/users/", { params: { pageNumber: 1 } })
      .then(({ data }) => setUsers(data?.users || data || []))
      .catch(() => setUsers([]));

    if (automation) {
      setActive(automation.active !== false);
      setName(automation.name || "");
      setDescription(automation.description || "");
      let s = {};
      try {
        s = automation.settings ? JSON.parse(automation.settings) : {};
      } catch (e) {
        s = {};
      }
      setRetroactive(!!s.retroactive);
      setIntervalActive(s.intervalActive !== false);
      setIntervalValue(s.intervalValue || 30);
      setIntervalUnit(s.intervalUnit || "segundos");
      setRespectBusinessHours(!!s.respectBusinessHours);
      try {
        setTriggers(JSON.parse(automation.triggers) || [{ type: "on_enter" }]);
      } catch (e) {
        setTriggers([{ type: "on_enter" }]);
      }
      try {
        setActions(JSON.parse(automation.actions) || [{ type: "message", body: "" }]);
      } catch (e) {
        setActions([{ type: "message", body: "" }]);
      }
    } else {
      setActive(true);
      setName("");
      setDescription("");
      setRetroactive(false);
      setIntervalActive(true);
      setIntervalValue(30);
      setIntervalUnit("segundos");
      setRespectBusinessHours(false);
      setTriggers([{ type: "on_enter" }]);
      setActions([{ type: "message", body: "" }]);
    }
  }, [open, automation]);

  const updateTrigger = (i, patch) =>
    setTriggers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const updateAction = (i, patch) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const otherTags = tags.filter((t) => String(t.id) !== String(tagId));

  const handleSave = async () => {
    if (!name.trim()) {
      toast.warn("Dê um nome à automação.");
      return;
    }
    if (!triggers.length || !actions.length) {
      toast.warn("Adicione ao menos um gatilho e uma ação.");
      return;
    }
    setSaving(true);
    const payload = {
      tagId,
      name: name.trim(),
      description: description.trim(),
      active,
      triggers,
      actions,
      settings: {
        retroactive,
        intervalActive,
        intervalValue: Number(intervalValue),
        intervalUnit,
        respectBusinessHours,
      },
    };
    try {
      if (automation) {
        await api.put(`/kanban-automations/${automation.id}`, payload);
      } else {
        await api.post("/kanban-automations", payload);
      }
      toast.success("Automação salva!");
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const renderActionConfig = (a, i) => {
    const meta = ACTION_TYPES.find((x) => x.value === a.type);
    if (meta?.soon) {
      return (
        <Typography variant="caption" color="textSecondary">
          Configuração desta ação estará disponível em breve.
        </Typography>
      );
    }
    switch (a.type) {
      case "message":
        return (
          <TextField
            label="Mensagem"
            value={a.body || ""}
            onChange={(e) => updateAction(i, { body: e.target.value })}
            variant="outlined"
            margin="dense"
            fullWidth
            multiline
            minRows={2}
            helperText="Use {{name}} para o nome do contato."
          />
        );
      case "template":
        return (
          <>
            <TextField
              label="Nome do template"
              value={a.templateName || ""}
              onChange={(e) => updateAction(i, { templateName: e.target.value })}
              variant="outlined"
              margin="dense"
              fullWidth
            />
            <TextField
              label="Idioma"
              value={a.languageCode || "pt_BR"}
              onChange={(e) => updateAction(i, { languageCode: e.target.value })}
              variant="outlined"
              margin="dense"
              fullWidth
            />
          </>
        );
      case "move_column":
        return (
          <FormControl variant="outlined" margin="dense" fullWidth>
            <InputLabel>Coluna de destino</InputLabel>
            <Select
              value={a.targetTagId || ""}
              onChange={(e) => updateAction(i, { targetTagId: e.target.value })}
              label="Coluna de destino"
            >
              {otherTags.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case "add_tag":
      case "remove_tag":
        return (
          <FormControl variant="outlined" margin="dense" fullWidth>
            <InputLabel>Tag</InputLabel>
            <Select
              value={a.tagId || ""}
              onChange={(e) => updateAction(i, { tagId: e.target.value })}
              label="Tag"
            >
              {tags.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case "assign_user":
        return (
          <FormControl variant="outlined" margin="dense" fullWidth>
            <InputLabel>Responsável</InputLabel>
            <Select
              value={a.userId || ""}
              onChange={(e) => updateAction(i, { userId: e.target.value })}
              label="Responsável"
            >
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case "delay":
        return (
          <TextField
            label="Aguardar (segundos)"
            type="number"
            value={a.seconds || ""}
            onChange={(e) => updateAction(i, { seconds: e.target.value })}
            variant="outlined"
            margin="dense"
            fullWidth
            helperText="Máximo de 300s (5 min)."
          />
        );
      case "create_activity":
        return (
          <>
            <TextField
              label="Descrição da atividade"
              value={a.body || ""}
              onChange={(e) => updateAction(i, { body: e.target.value })}
              variant="outlined"
              margin="dense"
              fullWidth
            />
            <TextField
              label="Em quantos minutos"
              type="number"
              value={a.minutes || 60}
              onChange={(e) => updateAction(i, { minutes: e.target.value })}
              variant="outlined"
              margin="dense"
              fullWidth
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{automation ? "Editar Automação" : "Nova Automação"}</span>
          <FormControlLabel
            control={
              <Switch color="primary" checked={active} onChange={(e) => setActive(e.target.checked)} />
            }
            label="Ativo"
          />
        </div>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          label="Nome da Automação"
          value={name}
          onChange={(e) => setName(e.target.value)}
          variant="outlined"
          margin="dense"
          fullWidth
          required
        />
        <TextField
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          variant="outlined"
          margin="dense"
          fullWidth
          multiline
          minRows={2}
        />

        <FormControlLabel
          control={
            <Switch color="primary" checked={retroactive} onChange={(e) => setRetroactive(e.target.checked)} />
          }
          label="Executar retroativamente (em breve)"
        />

        <Paper variant="outlined" style={{ padding: 12, marginTop: 8 }}>
          <FormControlLabel
            control={
              <Switch color="primary" checked={intervalActive} onChange={(e) => setIntervalActive(e.target.checked)} />
            }
            label="Intervalo entre Execuções"
          />
          {intervalActive && (
            <div style={{ display: "flex", gap: 8 }}>
              <TextField
                label="Intervalo"
                type="number"
                value={intervalValue}
                onChange={(e) => setIntervalValue(e.target.value)}
                variant="outlined"
                margin="dense"
                style={{ width: 120 }}
              />
              <FormControl variant="outlined" margin="dense" style={{ width: 160 }}>
                <InputLabel>Unidade</InputLabel>
                <Select value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value)} label="Unidade">
                  <MenuItem value="segundos">Segundos</MenuItem>
                  <MenuItem value="minutos">Minutos</MenuItem>
                  <MenuItem value="horas">Horas</MenuItem>
                </Select>
              </FormControl>
            </div>
          )}
          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={respectBusinessHours}
                onChange={(e) => setRespectBusinessHours(e.target.checked)}
              />
            }
            label="Respeitar horário de expediente (em breve)"
          />
        </Paper>

        <Divider style={{ margin: "16px 0" }} />

        {/* GATILHOS */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2">GATILHOS</Typography>
          <Button size="small" color="primary" onClick={() => setTriggers((p) => [...p, { type: "on_enter" }])}>
            + Adicionar Gatilho
          </Button>
        </div>
        {triggers.map((t, i) => (
          <Paper key={i} variant="outlined" style={{ padding: 8, marginTop: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <FormControl variant="outlined" margin="dense" fullWidth>
                <InputLabel>Tipo de Gatilho</InputLabel>
                <Select value={t.type} onChange={(e) => updateTrigger(i, { type: e.target.value })} label="Tipo de Gatilho">
                  {TRIGGER_TYPES.map((tt) => (
                    <MenuItem key={tt.value} value={tt.value}>
                      {tt.label}
                      {tt.soon ? " (em breve)" : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton size="small" onClick={() => setTriggers((p) => p.filter((_, idx) => idx !== i))}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </div>
            {isTimeTrigger(t.type) && (
              <TextField
                label="Dias"
                type="number"
                value={t.days || ""}
                onChange={(e) => updateTrigger(i, { days: e.target.value })}
                variant="outlined"
                margin="dense"
              />
            )}
          </Paper>
        ))}

        <Divider style={{ margin: "16px 0" }} />

        {/* AÇÕES */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2">AÇÕES</Typography>
          <Button size="small" color="primary" onClick={() => setActions((p) => [...p, { type: "message", body: "" }])}>
            + Adicionar Ação
          </Button>
        </div>
        <Typography variant="caption" color="textSecondary">
          As mensagens têm um atraso de segurança entre si para evitar bloqueios.
        </Typography>
        {actions.map((a, i) => (
          <Paper key={i} variant="outlined" style={{ padding: 8, marginTop: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <FormControl variant="outlined" margin="dense" fullWidth>
                <InputLabel>Tipo de Ação</InputLabel>
                <Select value={a.type} onChange={(e) => updateAction(i, { type: e.target.value })} label="Tipo de Ação">
                  {ACTION_TYPES.map((at) => (
                    <MenuItem key={at.value} value={at.value}>
                      {at.label}
                      {at.soon ? " (em breve)" : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton size="small" onClick={() => setActions((p) => p.filter((_, idx) => idx !== i))}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </div>
            {renderActionConfig(a, i)}
          </Paper>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={saving}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AutomationBuilderModal;
