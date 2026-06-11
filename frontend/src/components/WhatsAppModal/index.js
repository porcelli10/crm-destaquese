import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  DialogActions,
  CircularProgress,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@material-ui/core";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },

  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },

  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

const SessionSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, i18n.t("whatsappModal.formErrors.name.short"))
    .max(50, i18n.t("whatsappModal.formErrors.name.long"))
    .required(i18n.t("whatsappModal.formErrors.name.required")),
});

const FB_GRAPH_VERSION =
  process.env.REACT_APP_FACEBOOK_GRAPH_VERSION || "v21.0";

// Carrega o SDK do Facebook sob demanda e o inicializa uma única vez.
const loadFacebookSdk = () =>
  new Promise((resolve, reject) => {
    if (window.FB) {
      resolve(window.FB);
      return;
    }
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.REACT_APP_FACEBOOK_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: FB_GRAPH_VERSION,
      });
      resolve(window.FB);
    };
    const scriptId = "facebook-jssdk";
    if (document.getElementById(scriptId)) return; // já está carregando
    const js = document.createElement("script");
    js.id = scriptId;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    js.async = true;
    js.defer = true;
    js.crossOrigin = "anonymous";
    js.onerror = () =>
      reject(new Error("Falha ao carregar o SDK do Facebook."));
    document.body.appendChild(js);
  });

const WhatsAppModal = ({ open, onClose, whatsAppId }) => {

  const classes = useStyles();
  const initialState = {
    name: "",
    greetingMessage: "",
    complationMessage: "",
    outOfHoursMessage: "",
    ratingMessage: "",
    isDefault: false,
    token: "",
    provider: "beta",
    //timeSendQueue: 0,
    //sendIdQueue: 0,
    expiresInactiveMessage: "",
    expiresTicket: 0,
    timeUseBotQueues: 0,
    maxUseBotQueues: 3,
    integration: null,
    // Canal da conexão: "baileys" (QR Code) ou "official" (API Oficial / Meta Cloud API)
    channel: "baileys",
    officialWabaId: "",
    officialPhoneNumberId: "",
    officialAccessToken: "",
    officialVerifyToken: "",
    officialApiVersion: "v21.0"
  };

  const [whatsApp, setWhatsApp] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [queues, setQueues] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState(null)
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [fbLoading, setFbLoading] = useState(false);

  // Inicia o Embedded Signup da Meta: abre o popup do Facebook, captura o
  // waba_id/phone_number_id e o authorization code, envia ao backend para
  // trocar pelas credenciais e preenche o formulário automaticamente.
  const handleEmbeddedSignup = async (setFieldValue, currentName) => {
    const appId = process.env.REACT_APP_FACEBOOK_APP_ID;
    const configId = process.env.REACT_APP_FACEBOOK_CONFIG_ID;
    if (!appId || !configId) {
      toast.error(
        "Embedded Signup não configurado (App ID / Config ID ausentes no frontend)."
      );
      return;
    }

    setFbLoading(true);

    const sessionInfo = { wabaId: null, phoneNumberId: null };
    const messageHandler = (event) => {
      if (
        typeof event.origin !== "string" ||
        !event.origin.endsWith("facebook.com")
      )
        return;
      try {
        const data =
          typeof event.data === "string"
            ? JSON.parse(event.data)
            : event.data;
        if (data.type === "WA_EMBEDDED_SIGNUP") {
          sessionInfo.wabaId = data.data?.waba_id || sessionInfo.wabaId;
          sessionInfo.phoneNumberId =
            data.data?.phone_number_id || sessionInfo.phoneNumberId;
        }
      } catch (e) {
        /* mensagens não-JSON do Facebook são ignoradas */
      }
    };
    window.addEventListener("message", messageHandler);

    try {
      const FB = await loadFacebookSdk();

      // O SDK do Facebook rejeita callbacks async (constructor AsyncFunction).
      // Por isso o callback é uma função normal que delega o trabalho assíncrono
      // para uma IIFE interna.
      const onLogin = (response) => {
        window.removeEventListener("message", messageHandler);
        const code = response?.authResponse?.code;
        if (!code) {
          setFbLoading(false);
          toast.error("Conexão cancelada ou não autorizada.");
          return;
        }
        (async () => {
          try {
            const { data } = await api.post("/whatsapp/embedded-signup", {
              code,
              wabaId: sessionInfo.wabaId,
              phoneNumberId: sessionInfo.phoneNumberId,
            });
            setFieldValue("channel", "official");
            setFieldValue(
              "officialPhoneNumberId",
              data.officialPhoneNumberId || ""
            );
            setFieldValue("officialWabaId", data.officialWabaId || "");
            setFieldValue(
              "officialAccessToken",
              data.officialAccessToken || ""
            );
            setFieldValue(
              "officialApiVersion",
              data.officialApiVersion || FB_GRAPH_VERSION
            );
            if (data.suggestedName && !currentName) {
              setFieldValue("name", data.suggestedName);
            }
            toast.success(
              "WhatsApp conectado! Revise os dados e salve a conexão."
            );
          } catch (err) {
            toastError(err);
          } finally {
            setFbLoading(false);
          }
        })();
      };

      FB.login(onLogin, {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      });
    } catch (err) {
      window.removeEventListener("message", messageHandler);
      setFbLoading(false);
      toast.error(err.message || "Erro ao iniciar o Embedded Signup.");
    }
  };

    useEffect(() => {
      const fetchSession = async () => {
        if (!whatsAppId) return;

        try {
          
          const { data } = await api.get(`whatsapp/${whatsAppId}?session=0`);

          setWhatsApp(data);
          setSelectedPrompt( data.promptId );
          setSelectedIntegration(data.integrationId)

          const whatsQueueIds = data.queues?.map((queue) => queue.id);
          setSelectedQueueIds(whatsQueueIds);
          setSelectedQueueId(data.transferQueueId);
        } catch (err) {
          toastError(err);
        }
      };
      fetchSession();
    }, [whatsAppId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/prompt");
        setPrompts(data.prompts);

        const {data: dataIntegration} = await api.get("/queueIntegration");
        setIntegrations(dataIntegration.queueIntegrations);

      } catch (err) {
        toastError(err);
      }
    })();
  }, [whatsAppId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/queue");
        setQueues(data);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  const handleSaveWhatsApp = async (values) => {
    const whatsappData = {
      ...values, queueIds: selectedQueueIds, transferQueueId: selectedQueueId,
      promptId: selectedPrompt ? selectedPrompt : null,
      integrationId: selectedIntegration
    };
    delete whatsappData["queues"];
    delete whatsappData["session"];

    try {
      if (whatsAppId) {
        await api.put(`/whatsapp/${whatsAppId}`, whatsappData);
      } else {
        await api.post("/whatsapp", whatsappData);
      }
      toast.success(i18n.t("whatsappModal.success"));
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  const handleChangeQueue = (e) => {
    setSelectedQueueIds(e);
    setSelectedPrompt(null);
  };

  const handleChangePrompt = (e) => {
    setSelectedPrompt(e.target.value);
    setSelectedQueueIds([]);
  };

  const handleChangeIntegration = (e) => {
    setSelectedIntegration(e.target.value);
  }

  const handleClose = () => {
    onClose();
    setWhatsApp(initialState);
	  setSelectedQueueId(null);
    setSelectedQueueIds([]);
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>
          {whatsAppId
            ? i18n.t("whatsappModal.title.edit")
            : i18n.t("whatsappModal.title.add")}
        </DialogTitle>
        <Formik
          initialValues={whatsApp}
          enableReinitialize={true}
          validationSchema={SessionSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveWhatsApp(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, touched, errors, isSubmitting, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                <div className={classes.multFieldLine}>
                  <Grid spacing={2} container>
                    <Grid item>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.name")}
                        autoFocus
                        name="name"
                        error={touched.name && Boolean(errors.name)}
                        helperText={touched.name && errors.name}
                        variant="outlined"
                        margin="dense"
                        className={classes.textField}
                      />
                    </Grid>
                    <Grid style={{ paddingTop: 15 }} item>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            color="primary"
                            name="isDefault"
                            checked={values.isDefault}
                          />
                        }
                        label={i18n.t("whatsappModal.form.default")}
                      />
                    </Grid>
                  </Grid>
                </div>
                <FormControl
                  margin="dense"
                  variant="outlined"
                  fullWidth
                >
                  <InputLabel id="channel-select-label">
                    {i18n.t("whatsappModal.form.channel") || "Tipo de conexão"}
                  </InputLabel>
                  <Field
                    as={Select}
                    labelId="channel-select-label"
                    id="channel-select"
                    name="channel"
                    label={i18n.t("whatsappModal.form.channel") || "Tipo de conexão"}
                    disabled={Boolean(whatsAppId)}
                  >
                    <MenuItem value="baileys">WhatsApp (QR Code)</MenuItem>
                    <MenuItem value="official">WhatsApp API Oficial (Meta Cloud)</MenuItem>
                  </Field>
                </FormControl>
                {values.channel === "official" && (
                  <>
                    <div
                      style={{
                        border: "1px solid #682EE3",
                        borderRadius: 8,
                        padding: "12px 16px",
                        margin: "8px 0 4px",
                        textAlign: "center",
                      }}
                    >
                      <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                        Conecte o WhatsApp automaticamente pelo Facebook — sem
                        precisar copiar tokens manualmente.
                      </p>
                      <Button
                        onClick={() =>
                          handleEmbeddedSignup(setFieldValue, values.name)
                        }
                        disabled={fbLoading}
                        variant="contained"
                        style={{
                          backgroundColor: "#1877F2",
                          color: "#fff",
                          textTransform: "none",
                          fontWeight: 600,
                        }}
                      >
                        {fbLoading ? "Conectando..." : "Conectar com o Facebook"}
                        {fbLoading && (
                          <CircularProgress
                            size={18}
                            style={{ color: "#fff", marginLeft: 8 }}
                          />
                        )}
                      </Button>
                      <p style={{ margin: "8px 0 0", fontSize: 11, color: "#888" }}>
                        ou preencha os dados manualmente abaixo
                      </p>
                    </div>
                    <div>
                      <Field
                        as={TextField}
                        label="Phone Number ID"
                        name="officialPhoneNumberId"
                        fullWidth
                        variant="outlined"
                        margin="dense"
                        helperText="ID do número de telefone (Cloud API) — usado para receber as mensagens."
                      />
                    </div>
                    <div>
                      <Field
                        as={TextField}
                        label="WhatsApp Business Account ID (WABA ID)"
                        name="officialWabaId"
                        fullWidth
                        variant="outlined"
                        margin="dense"
                      />
                    </div>
                    <div>
                      <Field
                        as={TextField}
                        label="Token de Acesso (Permanente)"
                        name="officialAccessToken"
                        fullWidth
                        multiline
                        rows={2}
                        variant="outlined"
                        margin="dense"
                        helperText="Token do System User com permissão whatsapp_business_messaging."
                      />
                    </div>
                    <div>
                      <Field
                        as={TextField}
                        label="Verify Token (webhook)"
                        name="officialVerifyToken"
                        fullWidth
                        variant="outlined"
                        margin="dense"
                        helperText="Token de verificação cadastrado na Meta ao configurar o webhook."
                      />
                    </div>
                    <div>
                      <Field
                        as={TextField}
                        label="Versão da API"
                        name="officialApiVersion"
                        fullWidth
                        variant="outlined"
                        margin="dense"
                      />
                    </div>
                    <div>
                      <TextField
                        label="Callback URL (cadastrar na Meta)"
                        value={`${process.env.REACT_APP_PUBLIC_URL || process.env.REACT_APP_BACKEND_URL || ""}/webhooks`}
                        fullWidth
                        variant="outlined"
                        margin="dense"
                        InputProps={{ readOnly: true }}
                        helperText="Cole esta URL no campo Callback URL do webhook do app na Meta."
                      />
                    </div>
                  </>
                )}
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.greetingMessage")}
                    type="greetingMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="greetingMessage"
                    error={
                      touched.greetingMessage && Boolean(errors.greetingMessage)
                    }
                    helperText={
                      touched.greetingMessage && errors.greetingMessage
                    }
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.complationMessage")}
                    type="complationMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="complationMessage"
                    error={
                      touched.complationMessage &&
                      Boolean(errors.complationMessage)
                    }
                    helperText={
                      touched.complationMessage && errors.complationMessage
                    }
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.outOfHoursMessage")}
                    type="outOfHoursMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="outOfHoursMessage"
                    error={
                      touched.outOfHoursMessage &&
                      Boolean(errors.outOfHoursMessage)
                    }
                    helperText={
                      touched.outOfHoursMessage && errors.outOfHoursMessage
                    }
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.ratingMessage")}
                    type="ratingMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="ratingMessage"
                    error={
                      touched.ratingMessage && Boolean(errors.ratingMessage)
                    }
                    helperText={touched.ratingMessage && errors.ratingMessage}
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.token")}
                    type="token"
                    fullWidth
                    name="token"
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <QueueSelect
                  selectedQueueIds={selectedQueueIds}
                  onChange={(selectedIds) => handleChangeQueue(selectedIds)}
                />
                <FormControl
                  margin="dense"
                  variant="outlined"
                  fullWidth
                >
                  <InputLabel>
                    {i18n.t("whatsappModal.form.prompt")}
                  </InputLabel>
                  <Select
                    labelId="dialog-select-prompt-label"
                    id="dialog-select-prompt"
                    name="promptId"
                    value={selectedPrompt || ""}
                    onChange={handleChangePrompt}
                    label={i18n.t("whatsappModal.form.prompt")}
                    fullWidth
                    MenuProps={{
                      anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left",
                      },
                      transformOrigin: {
                        vertical: "top",
                        horizontal: "left",
                      },
                      getContentAnchorEl: null,
                    }}
                  >
                    {prompts.map((prompt) => (
                      <MenuItem
                        key={prompt.id}
                        value={prompt.id}
                      >
                        {prompt.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl
                  margin="dense"
                  variant="outlined"
                  fullWidth
                >
                  <InputLabel>
                    {i18n.t("whatsappModal.form.integration")}
                  </InputLabel>
                  <Select
                    labelId="dialog-select-integration-label"
                    id="dialog-select-integration"
                    name="promptId"
                    value={selectedIntegration || ""}
                    onChange={handleChangeIntegration}
                    label={i18n.t("whatsappModal.form.integration")}
                    fullWidth
                    MenuProps={{
                      anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left",
                      },
                      transformOrigin: {
                        vertical: "top",
                        horizontal: "left",
                      },
                      getContentAnchorEl: null,
                    }}
                  >
                    {integrations.map((prompt) => (
                      <MenuItem
                        key={prompt.id}
                        value={prompt.id}
                      >
                        {prompt.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <div>
                  <h3>{i18n.t("whatsappModal.form.queueRedirection")}</h3>
                  <p>{i18n.t("whatsappModal.form.queueRedirectionDesc")}</p>
				<Grid container spacing={2}>
                  <Grid item sm={6} >
                    <Field
                      fullWidth
                      type="number"
                      as={TextField}
                      label={i18n.t("whatsappModal.form.timeToTransfer")}
                      name="timeToTransfer"
                      error={touched.timeToTransfer && Boolean(errors.timeToTransfer)}
                      helperText={touched.timeToTransfer && errors.timeToTransfer}
                      variant="outlined"
                      margin="dense"
                      className={classes.textField}
                      InputLabelProps={{ shrink: values.timeToTransfer ? true : false }}
                    />

                  </Grid>

                  <Grid item sm={6}>
                    <QueueSelect
                      selectedQueueIds={selectedQueueId}
                      onChange={(selectedId) => {
                        setSelectedQueueId(selectedId)
                      }}
                      multiple={false}
                      title={i18n.t("whatsappModal.form.queue")}
                    />
                  </Grid>

                  </Grid>
                  <Grid spacing={2} container>
                    {/* ENCERRAR CHATS ABERTOS APÓS X HORAS */}
                    <Grid xs={12} md={12} item>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.expiresTicket")}
                        fullWidth
                        name="expiresTicket"
                        variant="outlined"
                        margin="dense"
                        error={touched.expiresTicket && Boolean(errors.expiresTicket)}
                        helperText={touched.expiresTicket && errors.expiresTicket}
                      />
                    </Grid>
                  </Grid>
                  {/* MENSAGEM POR INATIVIDADE*/}
                  <div>
                    <Field
                      as={TextField}
                      label={i18n.t("whatsappModal.form.expiresInactiveMessage")}
                      multiline
                      rows={4}
                      fullWidth
                      name="expiresInactiveMessage"
                      error={touched.expiresInactiveMessage && Boolean(errors.expiresInactiveMessage)}
                      helperText={touched.expiresInactiveMessage && errors.expiresInactiveMessage}
                      variant="outlined"
                      margin="dense"
                    />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("whatsappModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {whatsAppId
                    ? i18n.t("whatsappModal.buttons.okEdit")
                    : i18n.t("whatsappModal.buttons.okAdd")}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default React.memo(WhatsAppModal);
