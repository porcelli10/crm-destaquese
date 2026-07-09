import React, { useState, useEffect, useMemo } from "react";

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
import { makeStyles } from "@material-ui/core/styles";

import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  field: {
    marginBottom: theme.spacing(2),
  },
  hint: {
    display: "block",
    marginTop: -theme.spacing(1),
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

const LANGUAGES = [
  { code: "pt_BR", label: "Português (BR)" },
  { code: "en_US", label: "English (US)" },
  { code: "es_ES", label: "Español (ES)" },
  { code: "es", label: "Español" },
];

// nome do template: minúsculas, apenas letras/números/underscore
const normalizeName = (v) =>
  v.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");

const CreateTemplateModal = ({ open, onClose, onCreated }) => {
  const classes = useStyles();

  const [connections, setConnections] = useState([]);
  const [whatsappId, setWhatsappId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("pt_BR");
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [examples, setExamples] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWhatsappId("");
    setName("");
    setCategory("UTILITY");
    setLanguage("pt_BR");
    setHeaderText("");
    setBody("");
    setFooter("");
    setExamples({});

    const fetchConnections = async () => {
      try {
        const { data } = await api.get("/official-connections");
        // criação de template só é suportada em conexões iaSolution
        const iaConns = (data || []).filter((c) => c.channel === "iasolution");
        setConnections(iaConns);
        if (iaConns.length === 1) setWhatsappId(iaConns[0].id);
      } catch (err) {
        toastError(err);
      }
    };
    fetchConnections();
  }, [open]);

  // variáveis {{1}}, {{2}} ... presentes no corpo
  const variables = useMemo(() => {
    const found = [...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => m[1]);
    return [...new Set(found)].sort((a, b) => Number(a) - Number(b));
  }, [body]);

  const buildComponents = () => {
    const components = [];

    if (headerText.trim()) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: headerText.trim(),
      });
    }

    const bodyComp = { type: "BODY", text: body.trim() };
    if (variables.length) {
      bodyComp.example = {
        body_text: [variables.map((v) => (examples[v] || "").trim() || `exemplo${v}`)],
      };
    }
    components.push(bodyComp);

    if (footer.trim()) {
      components.push({ type: "FOOTER", text: footer.trim() });
    }

    return components;
  };

  const handleCreate = async () => {
    if (!whatsappId || !name.trim() || !body.trim()) {
      toast.warn("Selecione a conexão e preencha o nome e o corpo do template.");
      return;
    }
    if (variables.some((v) => !(examples[v] || "").trim())) {
      toast.warn("Preencha um exemplo para cada variável do corpo.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/official-templates/create", {
        whatsappId,
        name: normalizeName(name),
        category,
        language,
        components: buildComponents(),
      });
      toast.success("Template criado! Aguarde a aprovação da Meta.");
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>Criar template</DialogTitle>
      <DialogContent dividers>
        <FormControl variant="outlined" fullWidth className={classes.field}>
          <InputLabel>Conexão (iaSolution)</InputLabel>
          <Select
            value={whatsappId}
            onChange={(e) => setWhatsappId(e.target.value)}
            label="Conexão (iaSolution)"
          >
            {connections.length === 0 && (
              <MenuItem value="" disabled>
                Nenhuma conexão iaSolution encontrada
              </MenuItem>
            )}
            {connections.map((conn) => (
              <MenuItem key={conn.id} value={conn.id}>
                {conn.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Nome do template"
          variant="outlined"
          fullWidth
          className={classes.field}
          value={name}
          onChange={(e) => setName(normalizeName(e.target.value))}
          helperText="Apenas minúsculas, números e _ (ex: confirmacao_pedido)"
        />

        <FormControl variant="outlined" fullWidth className={classes.field}>
          <InputLabel>Categoria</InputLabel>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            label="Categoria"
          >
            <MenuItem value="UTILITY">Utilidade (UTILITY)</MenuItem>
            <MenuItem value="MARKETING">Marketing (MARKETING)</MenuItem>
          </Select>
        </FormControl>

        <FormControl variant="outlined" fullWidth className={classes.field}>
          <InputLabel>Idioma</InputLabel>
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            label="Idioma"
          >
            {LANGUAGES.map((l) => (
              <MenuItem key={l.code} value={l.code}>
                {l.label} ({l.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Cabeçalho (opcional)"
          variant="outlined"
          fullWidth
          className={classes.field}
          value={headerText}
          onChange={(e) => setHeaderText(e.target.value)}
        />

        <TextField
          label="Corpo da mensagem"
          variant="outlined"
          fullWidth
          multiline
          minRows={3}
          className={classes.field}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          helperText="Use {{1}}, {{2}}... para variáveis dinâmicas."
        />

        {variables.map((v) => (
          <TextField
            key={v}
            label={`Exemplo para a variável {{${v}}}`}
            variant="outlined"
            fullWidth
            className={classes.field}
            value={examples[v] || ""}
            onChange={(e) =>
              setExamples((prev) => ({ ...prev, [v]: e.target.value }))
            }
          />
        ))}

        <TextField
          label="Rodapé (opcional)"
          variant="outlined"
          fullWidth
          className={classes.field}
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
        />

        <Typography variant="caption" className={classes.hint}>
          O template é enviado para aprovação da Meta e só poderá ser usado após
          aprovado (pode levar de minutos a algumas horas).
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleCreate}
          color="primary"
          variant="contained"
          disabled={saving || !whatsappId || !name.trim() || !body.trim()}
        >
          {saving ? <CircularProgress size={20} color="inherit" /> : "Criar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateTemplateModal;
