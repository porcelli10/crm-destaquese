import { Request, Response } from "express";
import HandleHubWebhook from "../services/HubServices/HandleHubWebhook";
import { logger } from "../utils/logger";

/**
 * Webhook do Hub NotificaMe (WhatsApp / Facebook / Instagram).
 * Recebe os eventos de mensagem (MESSAGE) e de status (MESSAGE_STATUS)
 * no formato do notificamehubsdk e delega o processamento de forma assíncrona.
 */
export const webHook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { body } = req;

    // Responde rápido ao Hub e processa em background
    HandleHubWebhook(body).catch(err =>
      logger.error(`HandleHubWebhook error: ${err}`)
    );

    return res.status(200).json({ message: "EVENT_RECEIVED" });
  } catch (error) {
    logger.error(`HubWebhookController error: ${error}`);
    return res.status(200).json({ message: "EVENT_RECEIVED" });
  }
};
