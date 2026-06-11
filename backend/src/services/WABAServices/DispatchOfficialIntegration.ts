import axios from "axios";
import * as Sentry from "@sentry/node";
import QueueIntegrations from "../../models/QueueIntegrations";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";

interface DispatchMessage {
  id?: string;
  body: string;
  fromMe: boolean;
  mediaType?: string;
  mediaUrl?: string;
}

interface DispatchParams {
  whatsapp: Whatsapp;
  ticket: Ticket;
  contact?: Contact;
  message: DispatchMessage;
  /** payload bruto recebido da Meta (apenas para mensagens recebidas) */
  raw?: any;
}

/**
 * Encaminha mensagens do canal oficial (recebidas e enviadas) para a integração
 * n8n/webhook associada à conexão (whatsapp.integrationId) ou ao ticket.
 *
 * O fluxo do Baileys faz isso via `handleMessageIntegration`; o canal oficial
 * (Meta Cloud API) não passa por aquele listener, então replicamos aqui o
 * disparo para integrações do tipo "n8n"/"webhook". É best-effort: qualquer
 * erro é apenas logado e não interrompe o envio/recebimento da mensagem.
 */
const DispatchOfficialIntegration = async ({
  whatsapp,
  ticket,
  contact,
  message,
  raw
}: DispatchParams): Promise<void> => {
  try {
    const integrationId =
      (ticket && (ticket as any).integrationId) ||
      (whatsapp && (whatsapp as any).integrationId) ||
      null;

    if (!integrationId) return;

    const integration = await QueueIntegrations.findByPk(integrationId);
    if (!integration) return;
    if (integration.type !== "n8n" && integration.type !== "webhook") return;
    if (!integration.urlN8N) return;

    const resolvedContact = contact || ticket?.contact;

    const payload = {
      channel: "official",
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      ticketId: ticket?.id,
      fromMe: message.fromMe,
      type:
        message.mediaType && message.mediaType !== "conversation"
          ? message.mediaType
          : "text",
      body: message.body,
      messageId: message.id,
      mediaUrl: message.mediaUrl,
      contact: resolvedContact
        ? { name: resolvedContact.name, number: resolvedContact.number }
        : undefined,
      raw
    };

    await axios.post(integration.urlN8N, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`DispatchOfficialIntegration error: ${err}`);
  }
};

export default DispatchOfficialIntegration;
