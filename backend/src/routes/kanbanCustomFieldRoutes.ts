import express from "express";
import tokenAuth from "../middleware/tokenAuth";
import * as TicketCustomFieldController from "../controllers/TicketCustomFieldController";

const kanbanCustomFieldRoutes = express.Router();

// API externa: define campos personalizados de um card (ticket).
// Autenticação via header "Authorization: Bearer <TOKEN DA CONEXÃO>".
kanbanCustomFieldRoutes.post(
  "/api/kanban/custom-fields",
  tokenAuth,
  TicketCustomFieldController.setViaApi
);

export default kanbanCustomFieldRoutes;
