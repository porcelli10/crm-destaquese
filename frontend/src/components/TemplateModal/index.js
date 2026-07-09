import React, { useState, useEffect } from "react";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Paper from "@material-ui/core/Paper";
import Chip from "@material-ui/core/Chip";
import { makeStyles } from "@material-ui/core/styles";

import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  templateItem: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  templateHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  templateBody: {
    whiteSpace: "pre-wrap",
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  empty: {
    padding: theme.spacing(3),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  loadingBox: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(3),
  },
}));

const getComponentText = (template, type) =>
  template?.components?.find((c) => c.type === type)?.text || "";

const TemplateModal = ({ open, onClose, ticketId }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [sendingName, setSendingName] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !ticketId) return;

    const fetchTemplates = async () => {
      setLoading(true);
      setError("");
      setTemplates([]);
      try {
        // descobre a conexão do ticket
        const { data: ticket } = await api.get(`/tickets/${ticketId}`);
        const whatsappId = ticket?.whatsappId;

        const TEMPLATE_CHANNELS = ["official", "iasolution"];
        if (!TEMPLATE_CHANNELS.includes(ticket?.whatsapp?.channel)) {
          setError(
            "Templates estão disponíveis apenas para conexões WhatsApp API Oficial ou iaSolution."
          );
          return;
        }

        const { data } = await api.get(`/official-templates/${whatsappId}`);
        setTemplates(data || []);
      } catch (err) {
        toastError(err);
        setError("Não foi possível carregar os templates.");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [open, ticketId]);

  const handleSend = async (template) => {
    setSendingName(template.name);
    try {
      await api.post(`/official-templates/${ticketId}/send`, {
        templateName: template.name,
        languageCode: template.language,
        previewBody: getComponentText(template, "BODY"),
      });
      toast.success("Template enviado!");
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSendingName(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>Enviar template</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <div className={classes.loadingBox}>
            <CircularProgress />
          </div>
        ) : error ? (
          <Typography className={classes.empty}>{error}</Typography>
        ) : templates.length === 0 ? (
          <Typography className={classes.empty}>
            Nenhum template aprovado encontrado para esta conexão.
          </Typography>
        ) : (
          templates.map((template) => (
            <Paper
              key={`${template.name}_${template.language}`}
              variant="outlined"
              className={classes.templateItem}
            >
              <div className={classes.templateHeader}>
                <div>
                  <Typography variant="subtitle2">{template.name}</Typography>
                  <Chip
                    size="small"
                    label={template.language}
                    style={{ marginRight: 4 }}
                  />
                  <Chip size="small" label={template.category} />
                </div>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={sendingName !== null}
                  onClick={() => handleSend(template)}
                >
                  {sendingName === template.name ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    "Enviar"
                  )}
                </Button>
              </div>
              {getComponentText(template, "HEADER") && (
                <Typography variant="caption">
                  <b>{getComponentText(template, "HEADER")}</b>
                </Typography>
              )}
              <Typography className={classes.templateBody}>
                {getComponentText(template, "BODY")}
              </Typography>
            </Paper>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateModal;
