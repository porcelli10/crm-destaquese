import express from "express";
import tokenAuth from "../middleware/tokenAuth";
import isAuth from "../middleware/isAuth";
import * as TicketCustomFieldController from "../controllers/TicketCustomFieldController";

const kanbanCustomFieldRoutes = express.Router();

// API externa: define campos personalizados de um card (ticket).
// Autenticação via header "Authorization: Bearer <TOKEN DA CONEXÃO>".
kanbanCustomFieldRoutes.post(
  "/api/kanban/custom-fields",
  tokenAuth,
  TicketCustomFieldController.setViaApi
);

// Uso interno (painel): listar/editar/remover campos de um card.
kanbanCustomFieldRoutes.get(
  "/ticket-custom-fields/:ticketId",
  isAuth,
  TicketCustomFieldController.index
);

kanbanCustomFieldRoutes.post(
  "/ticket-custom-fields/:ticketId",
  isAuth,
  TicketCustomFieldController.upsert
);

kanbanCustomFieldRoutes.delete(
  "/ticket-custom-fields/:id",
  isAuth,
  TicketCustomFieldController.remove
);

export default kanbanCustomFieldRoutes;
