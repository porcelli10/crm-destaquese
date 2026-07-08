import { Router } from "express";
import * as IaSolutionWebhookController from "../controllers/IaSolutionWebhookController";

const iasolutionWebhookRoutes = Router();

// Montado em "/iasolution-webhook" pelo routes/index.ts.
// A URL cadastrada no painel do iaSolution deve incluir o id da conexão:
//   POST /iasolution-webhook/:whatsappId
iasolutionWebhookRoutes.post("/:whatsappId", IaSolutionWebhookController.webHook);

export default iasolutionWebhookRoutes;
