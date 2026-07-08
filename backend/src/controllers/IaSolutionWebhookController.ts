import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import HandleIaSolutionWebhook from "../services/IaSolutionServices/HandleIaSolutionWebhook";
import { logger } from "../utils/logger";

/**
 * Webhook do iaSolution Hub (wrapper da WhatsApp Cloud API).
 * A URL cadastrada no painel do iaSolution inclui o id da conexão
 * (POST /iasolution-webhook/:whatsappId), então o matching é direto e não
 * depende de nenhum campo do payload.
 */
export const webHook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { whatsappId } = req.params;

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp || whatsapp.channel !== "iasolution") {
      logger.warn(
        `Webhook iaSolution para conexão inválida (id ${whatsappId})`
      );
      // Responde 200 mesmo assim para o hub não ficar reenfileirando
      return res.status(200).json({ message: "EVENT_RECEIVED" });
    }

    // Responde rápido e processa em background
    HandleIaSolutionWebhook(whatsapp, req.body).catch(err =>
      logger.error(`HandleIaSolutionWebhook error: ${err}`)
    );

    return res.status(200).json({ message: "EVENT_RECEIVED" });
  } catch (error) {
    logger.error(`IaSolutionWebhookController error: ${error}`);
    return res.status(200).json({ message: "EVENT_RECEIVED" });
  }
};
