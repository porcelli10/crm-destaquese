import fs from "fs";
import path from "path";
import { extension as mimeExtension } from "mime-types";
import * as Sentry from "@sentry/node";

import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { downloadIaSolutionMedia, markIaSolutionMessageRead } from "./iaSolutionApi";
import DispatchAutomationWebhook from "../TicketServices/DispatchAutomationWebhook";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

interface MediaInfo {
  mediaType: string;
  mimeType?: string;
  caption?: string;
}

/**
 * Extrai o corpo textual e a referência de mídia de uma mensagem recebida.
 * O payload segue o formato da WhatsApp Cloud API.
 */
const parseIncomingMessage = (
  msg: any
): { body: string; media?: MediaInfo } => {
  switch (msg.type) {
    case "text":
      return { body: msg.text?.body || "" };
    case "button":
      return { body: msg.button?.text || "" };
    case "interactive":
      return {
        body:
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          ""
      };
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const payload = msg[msg.type];
      return {
        body: payload?.caption || "",
        media: {
          mediaType: msg.type === "sticker" ? "image" : msg.type,
          mimeType: payload?.mime_type,
          caption: payload?.caption
        }
      };
    }
    case "location":
      return {
        body: `https://maps.google.com/maps?q=${msg.location?.latitude},${msg.location?.longitude}`
      };
    case "contacts":
      return { body: JSON.stringify(msg.contacts) };
    default:
      return { body: "" };
  }
};

/**
 * Baixa a mídia (via download_url do webhook) e salva na pasta public.
 * Retorna o nome do arquivo.
 */
const downloadAndStoreMedia = async (
  whatsapp: Whatsapp,
  downloadUrl: string,
  fallbackMime?: string
): Promise<string | null> => {
  try {
    const { buffer, mimeType } = await downloadIaSolutionMedia(
      whatsapp,
      downloadUrl
    );
    const ext = mimeExtension(mimeType || fallbackMime || "") || "bin";
    const fileName = `${new Date().getTime()}_iasol.${ext}`;

    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder, { recursive: true });
    }
    fs.writeFileSync(path.join(publicFolder, fileName), buffer);
    return fileName;
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Erro ao baixar mídia iaSolution (${downloadUrl}): ${err}`);
    return null;
  }
};

const mapStatusToAck = (status: string): number => {
  switch (status) {
    case "sent":
      return 1;
    case "delivered":
      return 2;
    case "read":
      return 3;
    case "failed":
      return 5;
    default:
      return 0;
  }
};

/**
 * Processa um objeto `value` (formato Cloud API) do webhook do iaSolution:
 * mensagens recebidas e atualizações de status. A conexão já foi resolvida
 * pela rota (via id na URL).
 */
const processValue = async (
  whatsapp: Whatsapp,
  value: any
): Promise<void> => {
  const companyId = whatsapp.companyId;
  const io = getIO();

  // --- Atualizações de status (ack) ---
  if (Array.isArray(value.statuses)) {
    for (const status of value.statuses) {
      try {
        const messageToUpdate = await Message.findByPk(status.id);
        if (messageToUpdate) {
          const ack = mapStatusToAck(status.status);
          if (ack > messageToUpdate.ack) {
            await messageToUpdate.update({ ack });
            io.to(messageToUpdate.ticketId.toString()).emit(
              `company-${companyId}-appMessage`,
              { action: "update", message: messageToUpdate }
            );
          }
        }
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Erro ao atualizar status iaSolution: ${err}`);
      }
    }
  }

  // --- Mensagens recebidas ---
  if (Array.isArray(value.messages)) {
    for (const msg of value.messages) {
      try {
        // Detecta mensagem de SAÍDA (eco) — ex.: resposta enviada pelo celular.
        // O iaSolution reenvia a msg de saída em value.messages com
        // from = número business. Aqui identificamos o cliente correto e
        // tratamos como fromMe (em vez de criar contato com o nosso número).
        const businessNumber = (
          value.metadata?.display_phone_number || ""
        ).replace(/\D/g, "");
        const fromDigits = String(msg.from || "").replace(/\D/g, "");
        const contactsArr: any[] = Array.isArray(value.contacts)
          ? value.contacts
          : [];
        const fromInContacts = contactsArr.some(
          (c: any) => c.wa_id === msg.from
        );
        const isOutbound =
          (!!businessNumber && fromDigits === businessNumber) ||
          (contactsArr.length > 0 && !fromInContacts) ||
          String(msg.from_me) === "true" ||
          String(msg.direction).toUpperCase() === "OUT";

        // Cliente = quem NÃO é a gente. Em mensagem de saída (nossa), é o `to`.
        const customerNumber = isOutbound ? msg.to : msg.from;
        if (!customerNumber) {
          logger.warn(
            `iaSolution: mensagem sem número do cliente (outbound=${isOutbound}); ignorada`
          );
          continue;
        }

        const contactInfo = contactsArr.find(
          (c: any) => c.wa_id === customerNumber
        );
        const contactName = contactInfo?.profile?.name || customerNumber;

        // O serviço não sobrescreve o nome de um contato já existente.
        const contact = await CreateOrUpdateContactService({
          name: contactName,
          number: customerNumber,
          isGroup: false,
          companyId,
          whatsappId: whatsapp.id
        });

        // Inbound: find/create (reabre em pending se estava fechado).
        // Outbound (resposta pelo celular): usa o ticket mais recente do
        // cliente, sem reabrir/mudar status aqui; cria só se não existir.
        let ticket = null as any;
        if (isOutbound) {
          ticket = await Ticket.findOne({
            where: {
              contactId: contact.id,
              companyId,
              whatsappId: whatsapp.id
            },
            order: [["id", "DESC"]]
          });
        }
        if (!ticket) {
          ticket = await FindOrCreateTicketService(
            contact,
            whatsapp.id,
            isOutbound ? 0 : 1,
            companyId
          );
        }

        const { body, media } = parseIncomingMessage(msg);

        let mediaUrl: string | undefined;
        let mediaType = "conversation";

        // O iaSolution entrega o download_url já montado no nível da mensagem
        if (media && msg.download_url) {
          const fileName = await downloadAndStoreMedia(
            whatsapp,
            msg.download_url,
            media.mimeType
          );
          if (fileName) {
            mediaUrl = fileName;
            mediaType = media.mediaType;
          }
        }

        await CreateMessageService({
          messageData: {
            id: msg.id,
            ticketId: ticket.id,
            contactId: contact.id,
            body,
            fromMe: isOutbound,
            read: isOutbound,
            mediaType,
            mediaUrl
          },
          companyId
        });

        await ticket.update({ lastMessage: body });

        if (isOutbound) {
          // Resposta enviada pelo celular: aceita o ticket automaticamente
          // (pending -> open), o que dispara o webhook ticket.accepted (pausa
          // a IA). Só quando estava aguardando.
          if (ticket.status === "pending") {
            await UpdateTicketService({
              ticketData: { status: "open" },
              ticketId: ticket.id,
              companyId
            });
          }
        } else {
          // Mensagem recebida: encaminha para a IA e marca como lida.
          DispatchAutomationWebhook(companyId, {
            event: "message.received",
            channel: "iasolution",
            number: contact.number,
            contactName: contact.name,
            body,
            mediaType,
            mediaUrl,
            ticketId: ticket.id,
            ticketUuid: ticket.uuid,
            queueId: ticket.queueId,
            fromMe: false,
            companyId
          });

          markIaSolutionMessageRead(whatsapp, msg.id);
        }
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Erro ao processar mensagem iaSolution recebida: ${err}`);
      }
    }
  }
};

/**
 * Ponto de entrada do webhook. Normaliza tanto o envelope completo da Meta
 * (entry[].changes[].value) quanto um payload já "achatado" (value direto no
 * corpo, com messages/statuses no nível raiz).
 */
const HandleIaSolutionWebhook = async (
  whatsapp: Whatsapp,
  body: any
): Promise<void> => {
  if (!body) return;

  // Formato completo Meta: { object, entry: [{ changes: [{ value }] }] }
  if (Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change?.value) {
          await processValue(whatsapp, change.value);
        }
      }
    }
    return;
  }

  // Formato achatado: { value: {...} } ou o próprio corpo com messages/statuses
  const value = body.value || body;
  if (value.messages || value.statuses) {
    await processValue(whatsapp, value);
  }
};

export default HandleIaSolutionWebhook;
