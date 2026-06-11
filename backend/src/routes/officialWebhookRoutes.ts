import { Router } from "express";
import * as OfficialWebhookController from "../controllers/OfficialWebhookController";

const officialWebhookRoutes = Router();

// Montado em "/webhooks" pelo routes/index.ts (Callback URL da Meta)
officialWebhookRoutes.get("/", OfficialWebhookController.index);
officialWebhookRoutes.post("/", OfficialWebhookController.webHook);

export default officialWebhookRoutes;
