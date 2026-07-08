import { Router } from "express";
import * as HubWebhookController from "../controllers/HubWebhookController";

const hubWebhookRoutes = Router();

// Montado em "/hub-webhook" pelo routes/index.ts
// (URL a cadastrar como webhook no painel do NotificaMe Hub)
hubWebhookRoutes.post("/", HubWebhookController.webHook);

export default hubWebhookRoutes;
