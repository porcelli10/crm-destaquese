import fs from "fs";
import path from "path";
import axios from "axios";
import { extension as mimeExtension } from "mime-types";
import * as Sentry from "@sentry/node";

import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

interface MediaInfo {
  mediaType: string;
  fileUrl: string;
  mimeType?: string;
  caption?: string;
}

/**
 * Extrai o corpo textual e (se houver) a mídia de um array de `contents`
 * de uma mensagem recebida do Hub NotificaMe.
 */
const parseContents = (
  contents: any[]
): { body: string; media?: MediaInfo } => {
  if (!Array.isArray(contents)) return { body: "" };

  for (const content of contents) {
    switch (content?.type) {
      case "text":
        return { body: content.text || "" };
      case "file": {
        const mimeType: string = content.fileMimeType || "";
        const primary = mimeType.split("/")[0];
        const mediaType =
          primary === "image" ||
          primary === "video" ||
          primary === "audio"
            ? primary
            : "application";
        return {
          body: content.fileCaption || "",
          media: {
            mediaType,
            fileUrl: content.fileUrl,
            mimeType,
            caption: content.fileCaption
          }
        };
      }
      case "location":
        return {
          body: `https://maps.google.com/maps?q=${content.latitude},${content.longitude}`
        };
      case "contacts":
        return { body: JSON.stringify(content.contacts || content) };
      default:
        break;
    }
  }
  return { body: "" };
};

/**
 * Baixa uma mídia recebida (URL pública do Hub) e salva na pasta public.
 * Retorna o nome do arquivo.
 */
const downloadAndStoreMedia = async (
  fileUrl: string,
  mimeType?: string
): Promise<string | null> => {
  try {
    const { data } = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      timeout: 60000
    });
    const buffer = Buffer.from(data);
    const ext = mimeType ? mimeExtension(mimeType) || "bin" : "bin";
    const fileName = `${new Date().getTime()}_hub.${ext}`;

    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder, { recursive: true });
    }
    fs.writeFileSync(path.join(publicFolder, fileName), buffer);
    return fileName;
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Erro ao baixar mídia do Hub (${fileUrl}): ${err}`);
    return null;
  }
};

const mapStatusToAck = (status: string): number => {
  switch ((status || "").toUpperCase()) {
    case "SENT":
      return 1;
    case "DELIVERED":
      return 2;
    case "READ":
      return 3;
    case "REJECTED":
    case "FAILED":
    case "NOT_DELIVERED":
      return 5;
    default:
      return 0;
  }
};

/**
 * Localiza a conexão (Whatsapp) do canal Hub correspondente ao evento.
 * Casa pelo identificador do remetente (message.to === hubFrom); com fallbacks
 * pelo tipo de canal e pela única conexão Hub cadastrada.
 */
const findHubConnection = async (
  channelType: string,
  to?: string
): Promise<Whatsapp | null> => {
  if (to) {
    const byFrom = await Whatsapp.findOne({
      where: { hubFrom: to, channel: "hub" }
    });
    if (byFrom) return byFrom;
  }

  if (channelType) {
    const byChannel = await Whatsapp.findAll({
      where: { hubChannel: channelType, channel: "hub" }
    });
    if (byChannel.length === 1) return byChannel[0];
  }

  const hubConnections = await Whatsapp.findAll({
    where: { channel: "hub" }
  });
  if (hubConnections.length === 1) return hubConnections[0];

  return null;
};

/**
 * Processa um evento do webhook do Hub NotificaMe (mensagem recebida ou
 * atualização de status). O payload segue o formato do notificamehubsdk:
 *   { type: "MESSAGE" | "MESSAGE_STATUS", channel, direction, message, ... }
 */
const HandleHubWebhook = async (payload: any): Promise<void> => {
  const type = payload?.type;
  const channelType = payload?.channel;

  // --- Atualização de status (ack) ---
  if (type === "MESSAGE_STATUS") {
    try {
      const messageId = payload?.messageId;
      if (!messageId) return;

      const messageToUpdate = await Message.findByPk(messageId);
      if (!messageToUpdate) return;

      const ack = mapStatusToAck(
        payload?.messageStatus?.code || payload?.messageStatus
      );
      if (ack > messageToUpdate.ack) {
        await messageToUpdate.update({ ack });
        const companyId = messageToUpdate.companyId;
        if (companyId) {
          getIO()
            .to(messageToUpdate.ticketId.toString())
            .emit(`company-${companyId}-appMessage`, {
              action: "update",
              message: messageToUpdate
            });
        }
      }
    } catch (err) {
      Sentry.captureException(err);
      logger.error(`Erro ao atualizar status do Hub: ${err}`);
    }
    return;
  }

  // --- Mensagem recebida ---
  if (type !== "MESSAGE") return;

  const message = payload?.message;
  if (!message) return;

  // Ignora mensagens enviadas por nós (echo)
  const direction = payload?.direction || message?.direction;
  if (direction && String(direction).toUpperCase() === "OUT") return;

  try {
    const to = message.to;
    const whatsapp = await findHubConnection(channelType, to);

    if (!whatsapp) {
      logger.warn(
        `Webhook do Hub recebido (canal ${channelType}, to ${to}) sem conexão correspondente`
      );
      return;
    }

    const companyId = whatsapp.companyId;
    const from = message.from;
    const contactName = message.visitor?.name || from;

    const contact = await CreateOrUpdateContactService({
      name: contactName,
      number: from,
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

    const { body, media } = parseContents(message.contents);

    let mediaUrl: string | undefined;
    let mediaType = "conversation";

    if (media?.fileUrl) {
      const fileName = await downloadAndStoreMedia(
        media.fileUrl,
        media.mimeType
      );
      if (fileName) {
        mediaUrl = fileName;
        mediaType = media.mediaType;
      }
    }

    await CreateMessageService({
      messageData: {
        id: message.id || `${new Date().getTime()}_hub`,
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
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Erro ao processar mensagem recebida do Hub: ${err}`);
  }
};

export default HandleHubWebhook;
