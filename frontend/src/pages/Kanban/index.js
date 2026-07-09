import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import Board from "react-trello";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Menu from "@material-ui/core/Menu";
import Chip from "@material-ui/core/Chip";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import ViewColumnOutlinedIcon from "@material-ui/icons/ViewColumnOutlined";
import PersonAddOutlinedIcon from "@material-ui/icons/PersonAddOutlined";
import TuneOutlinedIcon from "@material-ui/icons/TuneOutlined";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import ColumnConfigModal from "../../components/ColumnConfigModal";
import TicketCustomFieldsModal from "../../components/TicketCustomFieldsModal";
import EventOutlinedIcon from "@material-ui/icons/EventOutlined";
import PersonOutlineOutlinedIcon from "@material-ui/icons/PersonOutlineOutlined";
import AccessTimeOutlinedIcon from "@material-ui/icons/AccessTimeOutlined";

// Campos configuráveis do card do Kanban (config salva na empresa via Settings)
const CARD_FIELDS = [
  { key: "schedule", label: "Agendamentos" },
  { key: "agent", label: "Responsável + fila" },
  { key: "waitTime", label: "Tempo de espera" },
  { key: "tags", label: "Tags + canal" },
  { key: "customFields", label: "Campos personalizados" },
  { key: "lastMessage", label: "Última mensagem" },
];

const DEFAULT_CARD_FIELDS = {
  schedule: true,
  agent: true,
  waitTime: true,
  tags: true,
  customFields: true,
  lastMessage: false,
};

const CHANNEL_LABEL = {
  iasolution: "iaSolution",
  official: "Oficial",
  baileys: "WhatsApp",
  hub: "Hub",
};

// "há 3d", "há 2h", "há 15min", "agora"
const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
};

const formatBRL = (v) => {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatSchedule = (sendAt) => {
  if (!sendAt) return "";
  const d = new Date(sendAt);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const useStyles = makeStyles((theme) => ({
  container: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 48px)",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: theme.spacing(1.5, 2),
    borderBottom: theme.palette.type === "light" ? "1px solid #E5E2DA" : "1px solid #333",
    backgroundColor: theme.palette.type === "light" ? "#FFFFFF" : theme.palette.tabHeaderBackground,
  },
  boardWrap: {
    flex: 1,
    overflow: "hidden",
    padding: theme.spacing(1),
  },
  button: {
    background: "#682EE3",
    border: "none",
    padding: "8px 12px",
    color: "white",
    fontWeight: "bold",
    borderRadius: "8px",
    cursor: "pointer",
  },
  colorField: {
    width: 64,
    minWidth: 64,
    padding: 0,
  },
}));

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();

  const [tags, setTags] = useState([]);
  const [tickets, setTickets] = useState([]);
  const { user } = useContext(AuthContext);
  const { profile } = user;
  const jsonString = user.queues.map((queue) => queue.UserQueue.queueId);

  // Dialogs
  const [columnOpen, setColumnOpen] = useState(false);
  const [columnName, setColumnName] = useState("");
  const [columnColor, setColumnColor] = useState("#682EE3");
  const [savingColumn, setSavingColumn] = useState(false);

  const [cardOpen, setCardOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardTagId, setCardTagId] = useState("");
  const [savingCard, setSavingCard] = useState(false);

  // Config de aparência do card (empresa toda, via Settings)
  const [cardFields, setCardFields] = useState(DEFAULT_CARD_FIELDS);
  const [configOpen, setConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Menu (⋮) e configurações da coluna
  const [colMenuAnchor, setColMenuAnchor] = useState(null);
  const [colMenuLane, setColMenuLane] = useState({ id: null, name: "" });
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [columnConfigTag, setColumnConfigTag] = useState(null);

  // Campos personalizados do card
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [customFieldsTicket, setCustomFieldsTicket] = useState({ id: null, name: "" });

  // Valor do negócio (por card)
  const [valueOpen, setValueOpen] = useState(false);
  const [valueTicket, setValueTicket] = useState({ id: null, name: "" });
  const [valueInput, setValueInput] = useState("");
  const [savingValue, setSavingValue] = useState(false);

  // meta por coluna (total R$ e contagem) para o header
  const laneMetaRef = useRef({});

  const handleSaveValue = async () => {
    setSavingValue(true);
    try {
      await api.put(`/kanban/tickets/${valueTicket.id}/value`, {
        value: Number(String(valueInput).replace(",", ".")) || 0,
      });
      setValueOpen(false);
      await fetchTickets(jsonString);
    } catch (err) {
      toast.error("Não foi possível salvar o valor.");
    } finally {
      setSavingValue(false);
    }
  };

  // header customizado da coluna precisa sempre do handler mais recente
  const openColumnMenuRef = useRef(() => {});
  openColumnMenuRef.current = (event, lane) => {
    if (!lane || lane.id === "lane0") return;
    setColMenuAnchor(event.currentTarget);
    setColMenuLane({ id: lane.id, name: lane.title });
  };

  const findTag = (id) => tags.find((t) => String(t.id) === String(id));

  const handleEditColumn = () => {
    const tag = findTag(colMenuLane.id);
    if (tag) {
      setColumnConfigTag({ id: tag.id, name: tag.name, color: tag.color });
      setColumnConfigOpen(true);
    }
    setColMenuAnchor(null);
  };

  const handleDuplicateColumn = async () => {
    const tag = findTag(colMenuLane.id);
    setColMenuAnchor(null);
    if (!tag) return;
    try {
      await api.post("/tags", {
        name: `${tag.name} (cópia)`,
        color: tag.color || "#682EE3",
        kanban: 1,
      });
      toast.success("Coluna duplicada!");
      await fetchTags();
    } catch (err) {
      toast.error("Não foi possível duplicar a coluna.");
    }
  };

  const handleDownloadCsv = () => {
    const tag = findTag(colMenuLane.id);
    setColMenuAnchor(null);
    if (!tag) return;
    const rows = tickets.filter((t) =>
      (t.tags || []).some((x) => x.id === tag.id)
    );
    const header = ["Nome", "Numero", "Valor", "Responsavel", "Fila", "Atualizado"];
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((t) =>
      [
        t.contact?.name,
        t.contact?.number,
        t.value,
        t.user?.name || "",
        t.queue?.name || "",
        t.updatedAt,
      ]
        .map(escape)
        .join(";")
    );
    const csv = [header.join(";"), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coluna_${tag.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // LaneHeader estável (criado uma vez) com engrenagem por coluna
  const CustomLaneHeader = useMemo(
    () => (props) => {
      const meta = laneMetaRef.current[props.id] || { total: 0, count: 0 };
      return (
        <div style={{ padding: "4px 2px 8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontWeight: 700 }}>{props.title}</span>
            {props.id !== "lane0" && (
              <IconButton
                size="small"
                style={{ color: "inherit", padding: 2 }}
                title="Opções da coluna"
                onClick={(e) => openColumnMenuRef.current(e, props)}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </div>
          <div style={{ fontSize: "0.78rem", opacity: 0.75 }}>
            Total: {formatBRL(meta.total)}
          </div>
          <div style={{ fontSize: "0.72rem", opacity: 0.6 }}>
            {meta.count} negócio{meta.count === 1 ? "" : "s"}
          </div>
        </div>
      );
    },
    []
  );

  const [file, setFile] = useState({ lanes: [] });

  const fetchCardConfig = async () => {
    try {
      const { data } = await api.get("/settings");
      const setting = (data || []).find((s) => s.key === "kanbanCardFields");
      if (setting?.value) {
        setCardFields({ ...DEFAULT_CARD_FIELDS, ...JSON.parse(setting.value) });
      }
    } catch (err) {
      // mantém o default se não houver config
    }
  };

  useEffect(() => {
    fetchCardConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.put("/settings/kanbanCardFields", {
        value: JSON.stringify(cardFields),
      });
      toast.success("Aparência do card salva!");
      setConfigOpen(false);
    } catch (err) {
      toast.error("Não foi possível salvar a configuração.");
    } finally {
      setSavingConfig(false);
    }
  };

  const fetchTickets = async (queueIds) => {
    try {
      const { data } = await api.get("/ticket/kanban", {
        params: {
          queueIds: JSON.stringify(queueIds),
          showAll: profile === "admin",
        },
      });
      setTickets(data.tickets);
    } catch (err) {
      console.log(err);
      setTickets([]);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await api.get("/tags/kanban");
      const fetchedTags = response.data.lista ?? [];
      setTags(fetchedTags);
      await fetchTickets(jsonString);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const popularCards = () => {
    const filteredTickets = tickets.filter(
      (ticket) => ticket.tags.length === 0
    );

    const buildCard = (ticket) => ({
      id: ticket.id.toString(),
      label: "Ticket nº " + ticket.id.toString(),
      description: (
        <div style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
          <div style={{ color: "#666" }}>{ticket.contact.number}</div>

          <div style={{ marginTop: 2 }}>
            <span
              style={{
                color: Number(ticket.value) > 0 ? "#159F5B" : "#682EE3",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => {
                setValueTicket({ id: ticket.id, name: ticket.contact.name });
                setValueInput(
                  Number(ticket.value) > 0 ? String(ticket.value) : ""
                );
                setValueOpen(true);
              }}
            >
              {Number(ticket.value) > 0 ? formatBRL(ticket.value) : "+ Valor"}
            </span>
          </div>

          {cardFields.agent && (ticket.user?.name || ticket.queue?.name) && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <PersonOutlineOutlinedIcon style={{ fontSize: 15, color: "#888" }} />
              <span>
                {ticket.user?.name || "Sem responsável"}
                {ticket.queue?.name ? ` · ${ticket.queue.name}` : ""}
              </span>
            </div>
          )}

          {cardFields.waitTime && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, color: "#888" }}>
              <AccessTimeOutlinedIcon style={{ fontSize: 15 }} />
              <span>Atualizado {timeAgo(ticket.updatedAt)}</span>
            </div>
          )}

          {cardFields.schedule && ticket.nextSchedule && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginTop: 4,
                color: "#682EE3",
                fontWeight: 600,
              }}
            >
              <EventOutlinedIcon style={{ fontSize: 15 }} />
              <span>{formatSchedule(ticket.nextSchedule.sendAt)}</span>
            </div>
          )}

          {cardFields.tags && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {ticket.whatsapp?.channel && (
                <Chip
                  size="small"
                  label={CHANNEL_LABEL[ticket.whatsapp.channel] || ticket.whatsapp.channel}
                  style={{ height: 20, fontSize: "0.68rem", background: "#EEE" }}
                />
              )}
              {(ticket.tags || []).map((t) => (
                <Chip
                  key={t.id}
                  size="small"
                  label={t.name}
                  style={{ height: 20, fontSize: "0.68rem", background: t.color || "#999", color: "#fff" }}
                />
              ))}
            </div>
          )}

          {cardFields.customFields &&
            (ticket.customFields || []).length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: "1px dashed #E0E0E0",
                }}
              >
                {ticket.customFields.map((cf) => (
                  <div key={cf.id} style={{ display: "flex", gap: 4 }}>
                    <span style={{ color: "#888", fontWeight: 600 }}>
                      {cf.name}:
                    </span>
                    <span>{cf.value}</span>
                  </div>
                ))}
              </div>
            )}

          {cardFields.lastMessage && ticket.lastMessage && (
            <div style={{ marginTop: 6, color: "#777", fontStyle: "italic" }}>
              {ticket.lastMessage.length > 60
                ? ticket.lastMessage.slice(0, 60) + "…"
                : ticket.lastMessage}
            </div>
          )}

          <button
            className={classes.button}
            style={{ marginTop: 8 }}
            onClick={() => {
              handleCardClick(ticket.uuid);
            }}
          >
            {i18n.t("kanban.seeTicket")}
          </button>
          <button
            className={classes.button}
            style={{ marginTop: 8, marginLeft: 6, background: "#8863E6" }}
            onClick={() => {
              setCustomFieldsTicket({ id: ticket.id, name: ticket.contact.name });
              setCustomFieldsOpen(true);
            }}
          >
            Campos
          </button>
        </div>
      ),
      title: ticket.contact.name,
      draggable: true,
      href: "/tickets/" + ticket.uuid,
    });

    const sumValues = (arr) =>
      arr.reduce((s, t) => s + (Number(t.value) || 0), 0);

    const laneMeta = {
      lane0: {
        total: sumValues(filteredTickets),
        count: filteredTickets.length,
      },
    };

    const lanes = [
      {
        id: "lane0",
        title: i18n.t("kanban.open"),
        label: filteredTickets.length.toString(),
        cards: filteredTickets.map(buildCard),
        style: {
          backgroundColor: "#fff",
          borderTop: "3px solid #159F5B",
          color: "#222",
        },
      },
      ...tags.map((tag) => {
        const tagsTickets = tickets.filter((ticket) => {
          const tagIds = ticket.tags.map((t) => t.id);
          return tagIds.includes(tag.id);
        });

        laneMeta[tag.id.toString()] = {
          total: sumValues(tagsTickets),
          count: tagsTickets.length,
        };

        return {
          id: tag.id.toString(),
          title: tag.name,
          label: tagsTickets.length.toString(),
          cards: tagsTickets.map(buildCard),
          style: {
            backgroundColor: "#fff",
            borderTop: `3px solid ${tag.color || "#999"}`,
            color: "#222",
          },
        };
      }),
    ];

    laneMetaRef.current = laneMeta;
    setFile({ lanes });
  };

  const handleCardClick = (uuid) => {
    history.push("/tickets/" + uuid);
  };

  useEffect(() => {
    popularCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, tickets, cardFields]);

  // ATENÇÃO react-trello chama onCardMoveAcrossLanes(fromLaneId, toLaneId, cardId).
  // Portanto os nomes abaixo estão "trocados" em relação ao real:
  //   cardId        => coluna de ORIGEM (fromLaneId)
  //   sourceLaneId  => coluna de DESTINO (toLaneId)  -> é a tag a adicionar
  //   targetLaneId  => id do TICKET (cardId)
  const handleCardMove = async (cardId, sourceLaneId, targetLaneId) => {
    const ticketId = targetLaneId; // id real do ticket
    const destinationTagId = sourceLaneId; // coluna de destino
    try {
      await api.delete(`/ticket-tags/${ticketId}`);
      toast.success(i18n.t("kanban.toasts.removed"));
      await api.put(`/ticket-tags/${ticketId}/${destinationTagId}`);
      toast.success(i18n.t("kanban.toasts.added"));

      // dispara automações de entrada (destino) e saída (origem) — best-effort
      if (destinationTagId && destinationTagId !== "lane0") {
        try {
          await api.post("/kanban-automations/trigger", {
            ticketId,
            tagId: destinationTagId,
            sourceTagId: cardId !== "lane0" ? cardId : undefined,
          });
        } catch (e) {
          // não bloqueia o move
        }
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handleCreateColumn = async () => {
    if (columnName.trim().length < 3) {
      toast.error("O nome da coluna precisa ter pelo menos 3 caracteres.");
      return;
    }
    setSavingColumn(true);
    try {
      await api.post("/tags", {
        name: columnName.trim(),
        color: columnColor,
        kanban: 1,
      });
      toast.success("Coluna criada com sucesso!");
      setColumnOpen(false);
      setColumnName("");
      setColumnColor("#682EE3");
      await fetchTags();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Não foi possível criar a coluna."
      );
    } finally {
      setSavingColumn(false);
    }
  };

  const handleCreateCard = async () => {
    if (!cardName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!cardNumber.replace(/\D/g, "")) {
      toast.error("Informe um número válido.");
      return;
    }
    setSavingCard(true);
    try {
      await api.post("/kanban/cards", {
        name: cardName.trim(),
        number: cardNumber.replace(/\D/g, ""),
        tagId: cardTagId || undefined,
      });
      toast.success("Card criado com sucesso!");
      setCardOpen(false);
      setCardName("");
      setCardNumber("");
      setCardTagId("");
      await fetchTags();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Não foi possível criar o card."
      );
    } finally {
      setSavingCard(false);
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.toolbar}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<ViewColumnOutlinedIcon />}
          onClick={() => setColumnOpen(true)}
        >
          Nova coluna
        </Button>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<PersonAddOutlinedIcon />}
          onClick={() => setCardOpen(true)}
        >
          Novo card
        </Button>
        <div style={{ flex: 1 }} />
        <Tooltip title="Configurar aparência do card">
          <IconButton color="primary" onClick={() => setConfigOpen(true)}>
            <TuneOutlinedIcon />
          </IconButton>
        </Tooltip>
      </div>

      <div className={classes.boardWrap}>
        <Board
          data={file}
          onCardMoveAcrossLanes={handleCardMove}
          components={{ LaneHeader: CustomLaneHeader }}
          style={{ backgroundColor: "transparent", height: "100%" }}
        />
      </div>

      {/* Dialog: Nova coluna */}
      <Dialog open={columnOpen} onClose={() => setColumnOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nova coluna</DialogTitle>
        <DialogContent>
          <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 4 }}>
            <TextField
              label="Nome da coluna"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
              autoFocus
            />
            <TextField
              label="Cor"
              type="color"
              value={columnColor}
              onChange={(e) => setColumnColor(e.target.value)}
              variant="outlined"
              margin="dense"
              className={classes.colorField}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnOpen(false)} color="secondary">
            Cancelar
          </Button>
          <Button onClick={handleCreateColumn} color="primary" variant="contained" disabled={savingColumn}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menu (⋮) da coluna */}
      <Menu
        anchorEl={colMenuAnchor}
        open={Boolean(colMenuAnchor)}
        onClose={() => setColMenuAnchor(null)}
      >
        <MenuItem onClick={handleEditColumn}>Editar coluna</MenuItem>
        <MenuItem onClick={handleDownloadCsv}>Baixar CSV</MenuItem>
        <MenuItem onClick={handleDuplicateColumn}>Duplicar coluna</MenuItem>
      </Menu>

      {/* Modal: Configurações da Coluna (Gerais / Automações / Integrações) */}
      <ColumnConfigModal
        open={columnConfigOpen}
        onClose={() => setColumnConfigOpen(false)}
        tag={columnConfigTag}
        tags={tags}
        onChanged={() => fetchTags()}
      />

      {/* Dialog: Campos personalizados do card */}
      <TicketCustomFieldsModal
        open={customFieldsOpen}
        onClose={() => setCustomFieldsOpen(false)}
        ticketId={customFieldsTicket.id}
        ticketName={customFieldsTicket.name}
        onSaved={() => fetchTickets(jsonString)}
      />

      {/* Dialog: Valor do negócio */}
      <Dialog open={valueOpen} onClose={() => setValueOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Valor do negócio{valueTicket.name ? ` · ${valueTicket.name}` : ""}</DialogTitle>
        <DialogContent>
          <TextField
            label="Valor (R$)"
            type="number"
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
            autoFocus
            placeholder="0,00"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValueOpen(false)} color="secondary">
            Cancelar
          </Button>
          <Button
            onClick={handleSaveValue}
            color="primary"
            variant="contained"
            disabled={savingValue}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Configurar aparência do card */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Aparência do card</DialogTitle>
        <DialogContent>
          <p style={{ marginTop: 0, color: "#777", fontSize: "0.85rem" }}>
            Escolha quais informações aparecem nos cards do pipeline (vale para
            toda a empresa).
          </p>
          {CARD_FIELDS.map((f) => (
            <div key={f.key}>
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={!!cardFields[f.key]}
                    onChange={(e) =>
                      setCardFields((prev) => ({
                        ...prev,
                        [f.key]: e.target.checked,
                      }))
                    }
                  />
                }
                label={f.label}
              />
            </div>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)} color="secondary">
            Cancelar
          </Button>
          <Button
            onClick={handleSaveConfig}
            color="primary"
            variant="contained"
            disabled={savingConfig}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Novo card */}
      <Dialog open={cardOpen} onClose={() => setCardOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Novo card de cliente</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome do cliente"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
            autoFocus
          />
          <TextField
            label="Número (DDI + DDD + número)"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="5511999999999"
          />
          <FormControl variant="outlined" margin="dense" fullWidth>
            <InputLabel id="card-column-label">Coluna</InputLabel>
            <Select
              labelId="card-column-label"
              label="Coluna"
              value={cardTagId}
              onChange={(e) => setCardTagId(e.target.value)}
            >
              <MenuItem value="">
                <em>{i18n.t("kanban.open")}</em>
              </MenuItem>
              {tags.map((tag) => (
                <MenuItem key={tag.id} value={tag.id}>
                  {tag.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCardOpen(false)} color="secondary">
            Cancelar
          </Button>
          <Button onClick={handleCreateCard} color="primary" variant="contained" disabled={savingCard}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Kanban;
