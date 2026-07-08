import * as Sentry from "@sentry/node";
import path from "path";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { getHubChannel, FileContent } from "./notificameHubClient";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

/**
 * Converte o mimetype no tipo de mídia usado para persistência local.
 */
const resolveMediaType = (mimetype: string): string => {
  const primary = mimetype.split("/")[0];
  if (primary === "image") return "image";
  if (primary === "video") return "video";
  if (primary === "audio") return "audio";
  return "application";
};

/**
 * Envia uma mídia pelo Hub NotificaMe. O Hub baixa o arquivo a partir de uma
 * URL pública, então usamos a URL do arquivo já salvo pelo multer na pasta
 * public (${BACKEND_URL}/public/<arquivo>).
 */
const SendMediaMessageHub = async ({
  media,
  ticket,
  body
}: Request): Promise<void> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }

  const bodyMessage = body ? formatBody(body, ticket.contact) : "";
  const mediaType = resolveMediaType(media.mimetype);
  const fileName = path.basename(media.path);
  const publicUrl = `${process.env.BACKEND_URL}/public/${fileName}`;

  try {
    const channel = getHubChannel(whatsapp);
    const response = await channel.sendMessage(
      whatsapp.hubFrom,
      ticket.contact.number,
      new FileContent(
        publicUrl,
        media.mimetype,
        bodyMessage,
        media.originalname
      )
    );

    const messageId =
      response?.id || response?.messageId || `${new Date().getTime()}`;

    await CreateMessageService({
      messageData: {
        id: messageId,
        ticketId: ticket.id,
        body: bodyMessage || media.originalname,
        fromMe: true,
        read: true,
        mediaType,
        mediaUrl: fileName,
        ack: 1
      },
      companyId: ticket.companyId
    });

    await ticket.update({ lastMessage: bodyMessage || media.originalname });
  } catch (err: any) {
    Sentry.captureException(err);
    console.log(
      "SendMediaMessageHub error:",
      err?.response?.data || err?.message || err
    );
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendMediaMessageHub;
