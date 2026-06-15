import React, { useState, useEffect, useContext } from "react";
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
import ViewColumnOutlinedIcon from "@material-ui/icons/ViewColumnOutlined";
import PersonAddOutlinedIcon from "@material-ui/icons/PersonAddOutlined";

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

  const [file, setFile] = useState({ lanes: [] });

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
        <div>
          <p>
            {ticket.contact.number}
            <br />
            {ticket.lastMessage}
          </p>
          <button
            className={classes.button}
            onClick={() => {
              handleCardClick(ticket.uuid);
            }}
          >
            {i18n.t("kanban.seeTicket")}
          </button>
        </div>
      ),
      title: ticket.contact.name,
      draggable: true,
      href: "/tickets/" + ticket.uuid,
    });

    const lanes = [
      {
        id: "lane0",
        title: i18n.t("kanban.open"),
        label: filteredTickets.length.toString(),
        cards: filteredTickets.map(buildCard),
      },
      ...tags.map((tag) => {
        const tagsTickets = tickets.filter((ticket) => {
          const tagIds = ticket.tags.map((t) => t.id);
          return tagIds.includes(tag.id);
        });

        return {
          id: tag.id.toString(),
          title: tag.name,
          label: tagsTickets.length.toString(),
          cards: tagsTickets.map(buildCard),
          style: { backgroundColor: tag.color, color: "white" },
        };
      }),
    ];

    setFile({ lanes });
  };

  const handleCardClick = (uuid) => {
    history.push("/tickets/" + uuid);
  };

  useEffect(() => {
    popularCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, tickets]);

  const handleCardMove = async (cardId, sourceLaneId, targetLaneId) => {
    try {
      await api.delete(`/ticket-tags/${targetLaneId}`);
      toast.success(i18n.t("kanban.toasts.removed"));
      await api.put(`/ticket-tags/${targetLaneId}/${sourceLaneId}`);
      toast.success(i18n.t("kanban.toasts.added"));
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
      </div>

      <div className={classes.boardWrap}>
        <Board
          data={file}
          onCardMoveAcrossLanes={handleCardMove}
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
