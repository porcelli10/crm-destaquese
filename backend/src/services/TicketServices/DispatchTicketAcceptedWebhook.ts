import axios from "axios";
import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";
import Ticket from "../../models/Ticket";
import ListSettingsServiceOne from "../SettingServices/ListSettingsServiceOne";

/**
 * Dispara um webhook (best-effort) quando um ticket é ACEITO (pending -> open).
 * A URL é configurada no painel em Configurações (Setting key
 * "ticketAcceptedWebhookUrl"). Uso típico: pausar um agente de IA para o número
 * do cliente assim que um atendente humano assume o ticket.
 */
const DispatchTicketAcceptedWebhook = async (
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  try {
    const setting = await ListSettingsServiceOne({
      companyId,
      key: "ticketAcceptedWebhookUrl"
    });

    const url = setting?.value?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return; // não configurado / URL inválida
    }

    const payload = {
      event: "ticket.accepted",
      number: ticket.contact?.number,
      contactName: ticket.contact?.name,
      ticketId: ticket.id,
      ticketUuid: ticket.uuid,
      queueId: ticket.queueId,
      userId: ticket.userId,
      companyId
    };

    await axios.post(url, payload, { timeout: 15000 });
    logger.info(
      `Webhook ticket.accepted enviado (ticket ${ticket.id}, número ${payload.number})`
    );
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(
      `Erro ao disparar webhook ticket.accepted: ${
        err?.response?.data || err?.message || err
      }`
    );
  }
};

export default DispatchTicketAcceptedWebhook;
