import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import HandleOfficialWebhook from "../services/WABAServices/HandleOfficialWebhook";
import { logger } from "../utils/logger";

/**
 * Webhook da API Oficial do WhatsApp (Meta Cloud API).
 * Nome próprio (OfficialWebhookController) para não colidir com o
 * WebHookController genérico do Facebook (Messenger/Instagram) já existente.
 */

/**
 * Verificação do webhook (GET) exigida pela Meta ao configurar a Callback URL.
 * Aceita o VERIFY_TOKEN global (.env) ou o token configurado em qualquer
 * conexão oficial.
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "whaticket";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token) {
    let valid = token === VERIFY_TOKEN;

    if (!valid) {
      const found = await Whatsapp.findOne({
        where: { officialVerifyToken: token as string }
      });
      valid = !!found;
    }

    if (valid) {
      return res.status(200).send(challenge);
    }
  }

  return res.status(403).json({ message: "Forbidden" });
};

/**
 * Recebimento de eventos (POST). Trata o canal oficial do WhatsApp
 * (whatsapp_business_account).
 */
export const webHook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { body } = req;

    if (body.object === "whatsapp_business_account") {
      // Responde rápido à Meta e processa de forma assíncrona
      if (Array.isArray(body.entry)) {
        body.entry.forEach((entry: any) => {
          entry.changes?.forEach((change: any) => {
            if (change.field === "messages" && change.value) {
              HandleOfficialWebhook(change.value).catch(err =>
                logger.error(`HandleOfficialWebhook error: ${err}`)
              );
            }
          });
        });
      }

      return res.status(200).json({ message: "EVENT_RECEIVED" });
    }

    return res.status(404).json({ message: body });
  } catch (error) {
    logger.error(`OfficialWebhookController error: ${error}`);
    return res.status(200).json({ message: "EVENT_RECEIVED" });
  }
};
