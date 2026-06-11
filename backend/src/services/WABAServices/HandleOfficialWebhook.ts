import fs from "fs";
import path from "path";
import { extension as mimeExtension } from "mime-types";
import * as Sentry from "@sentry/node";

import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import {
  downloadOfficialMedia,
  getOfficialMediaUrl,
  markOfficialMessageRead
} from "./whatsappOfficialApi";
import DispatchOfficialIntegration from "./DispatchOfficialIntegration";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

interface MediaInfo {
  mediaType: string;
  mediaId: string;
  caption?: string;
}

/**
 * Extrai, do payload de uma mensagem recebida, o corpo textual e (se houver)
 * a referência da mídia a ser baixada.
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
          mediaId: payload?.id,
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
 * Baixa uma mídia recebida e salva na pasta public. Retorna o nome do arquivo.
 */
const downloadAndStoreMedia = async (
  whatsapp: Whatsapp,
  mediaId: string
): Promise<string | null> => {
  try {
    const { url, mimeType } = await getOfficialMediaUrl(whatsapp, mediaId);
    if (!url) return null;

    const buffer = await downloadOfficialMedia(whatsapp, url);
    const ext = mimeExtension(mimeType) || "bin";
    const fileName = `${new Date().getTime()}_${mediaId}.${ext}`;

    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder, { recursive: true });
    }
    fs.writeFileSync(path.join(publicFolder, fileName), buffer);
    return fileName;
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Erro ao baixar mídia oficial ${mediaId}: ${err}`);
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
 * Processa um objeto `value` de uma mudança (change) do webhook oficial,
 * tratando mensagens recebidas e atualizações de status (ack).
 */
const HandleOfficialWebhook = async (value: any): Promise<void> => {
  const phoneNumberId = value?.metadata?.phone_number_id;
  if (!phoneNumberId) return;

  let whatsapp = await Whatsapp.findOne({
    where: { officialPhoneNumberId: phoneNumberId, channel: "official" }
  });

  // Fallback: o botão "Testar" do webhook na Meta envia um phone_number_id
  // fictício, que não casa com nenhuma conexão. Se existir exatamente UMA
  // conexão oficial cadastrada, usamos ela para que o teste apareça no CRM.
  if (!whatsapp) {
    const officialConnections = await Whatsapp.findAll({
      where: { channel: "official" }
    });
    if (officialConnections.length === 1) {
      whatsapp = officialConnections[0];
      logger.info(
        `Webhook oficial sem phone_number_id correspondente (${phoneNumberId}); usando a única conexão oficial (id ${whatsapp.id}) como fallback`
      );
    }
  }

  if (!whatsapp) {
    logger.warn(
      `Webhook oficial recebido para phone_number_id ${phoneNumberId} sem conexão correspondente`
    );
    return;
  }

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
        logger.error(`Erro ao atualizar status oficial: ${err}`);
      }
    }
  }

  // --- Mensagens recebidas ---
  if (Array.isArray(value.messages)) {
    for (const msg of value.messages) {
      try {
        const contactInfo = value.contacts?.find(
          (c: any) => c.wa_id === msg.from
        );
        const contactName = contactInfo?.profile?.name || msg.from;

        const contact = await CreateOrUpdateContactService({
          name: contactName,
          number: msg.from,
          isGroup: false,
          companyId,
          whatsappId: whatsapp.id
        });

        const ticket = await FindOrCreateTicketService(
          contact,
          whatsapp.id,
          1,
          companyId
        );

        const { body, media } = parseIncomingMessage(msg);

        let mediaUrl: string | undefined;
        let mediaType = "conversation";

        if (media?.mediaId) {
          const fileName = await downloadAndStoreMedia(
            whatsapp,
            media.mediaId
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
            fromMe: false,
            read: false,
            mediaType,
            mediaUrl
          },
          companyId
        });

        await ticket.update({ lastMessage: body });

        // Encaminha para a integração n8n/webhook da conexão (best-effort)
        await DispatchOfficialIntegration({
          whatsapp,
          ticket,
          contact,
          message: { id: msg.id, body, fromMe: false, mediaType, mediaUrl },
          raw: msg
        });

        // Marca como lida na conta oficial (best-effort)
        markOfficialMessageRead(whatsapp, msg.id);
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Erro ao processar mensagem oficial recebida: ${err}`);
      }
    }
  }
};

export default HandleOfficialWebhook;
