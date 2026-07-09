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
import CircularProgress from "@material-ui/core/CircularProgress";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";

import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  field: {
    marginBottom: theme.spacing(2),
  },
  preview: {
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    whiteSpace: "pre-wrap",
    fontSize: "0.85rem",
    color: theme.palette.text.secondary,
  },
}));

const getComponentText = (template, type) =>
  template?.components?.find((c) => c.type === type)?.text || "";

const SendTemplateModal = ({ open, onClose, initialNumber }) => {
  const classes = useStyles();

  const [connections, setConnections] = useState([]);
  const [whatsappId, setWhatsappId] = useState("");
  const [number, setNumber] = useState("");
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);

  // carrega conexões oficiais ao abrir
  useEffect(() => {
    if (!open) return;
    setNumber(initialNumber || "");
    setWhatsappId("");
    setTemplates([]);
    setTemplateName("");

    const fetchConnections = async () => {
      try {
        const { data } = await api.get("/official-connections");
        setConnections(data || []);
        if ((data || []).length === 1) setWhatsappId(data[0].id);
      } catch (err) {
        toastError(err);
      }
    };
    fetchConnections();
  }, [open, initialNumber]);

  // carrega templates quando escolhe a conexão
  useEffect(() => {
    if (!whatsappId) {
      setTemplates([]);
      return;
    }
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      setTemplateName("");
      try {
        const { data } = await api.get(`/official-templates/${whatsappId}`);
        setTemplates(data || []);
      } catch (err) {
        toastError(err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, [whatsappId]);

  const selectedTemplate = templates.find((t) => t.name === templateName);

  const handleSend = async () => {
    if (!whatsappId || !number || !selectedTemplate) {
      toast.warn("Selecione a conexão, o número e o template.");
      return;
    }
    setSending(true);
    try {
      await api.post("/official-templates/send-to", {
        whatsappId,
        number,
        templateName: selectedTemplate.name,
        languageCode: selectedTemplate.language,
        previewBody: getComponentText(selectedTemplate, "BODY"),
      });
      toast.success("Template enviado!");
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Enviar template</DialogTitle>
      <DialogContent dividers>
        <FormControl variant="outlined" fullWidth className={classes.field}>
          <InputLabel>De (conexão)</InputLabel>
          <Select
            value={whatsappId}
            onChange={(e) => setWhatsappId(e.target.value)}
            label="De (conexão)"
          >
            {connections.length === 0 && (
              <MenuItem value="" disabled>
                Nenhuma conexão com suporte a templates
              </MenuItem>
            )}
            {connections.map((conn) => (
              <MenuItem key={conn.id} value={conn.id}>
                {conn.name}
                {conn.displayPhoneNumber ? ` — ${conn.displayPhoneNumber}` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Para (número com DDI, ex: 5511999998888)"
          variant="outlined"
          fullWidth
          className={classes.field}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />

        <FormControl variant="outlined" fullWidth className={classes.field}>
          <InputLabel>Template</InputLabel>
          <Select
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            label="Template"
            disabled={!whatsappId || loadingTemplates}
          >
            {loadingTemplates && (
              <MenuItem value="" disabled>
                Carregando...
              </MenuItem>
            )}
            {!loadingTemplates && templates.length === 0 && (
              <MenuItem value="" disabled>
                Nenhum template aprovado
              </MenuItem>
            )}
            {templates.map((t) => (
              <MenuItem key={`${t.name}_${t.language}`} value={t.name}>
                {t.name} ({t.language})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedTemplate && (
          <Paper variant="outlined" className={classes.preview}>
            {getComponentText(selectedTemplate, "HEADER") && (
              <Typography variant="caption">
                <b>{getComponentText(selectedTemplate, "HEADER")}</b>
              </Typography>
            )}
            <div>{getComponentText(selectedTemplate, "BODY")}</div>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" disabled={sending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSend}
          color="primary"
          variant="contained"
          disabled={sending || !whatsappId || !number || !templateName}
        >
          {sending ? <CircularProgress size={20} color="inherit" /> : "Enviar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SendTemplateModal;
