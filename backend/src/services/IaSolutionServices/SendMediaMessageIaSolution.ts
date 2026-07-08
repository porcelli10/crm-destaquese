import * as Sentry from "@sentry/node";
import path from "path";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { sendIaSolutionMedia } from "./iaSolutionApi";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

/**
 * Converte o mimetype no tipo de mídia da Cloud API.
 */
const resolveMediaType = (mimetype: string): string => {
  const primary = mimetype.split("/")[0];
  if (primary === "image") return "image";
  if (primary === "video") return "video";
  if (primary === "audio") return "audio";
  return "document";
};

/**
 * Envia uma mídia pelo iaSolution Hub. A API baixa o arquivo a partir de uma
 * URL pública (link), então usamos a URL do arquivo já salvo pelo multer na
 * pasta public (${BACKEND_URL}/public/<arquivo>).
 */
const SendMediaMessageIaSolution = async ({
  media,
  ticket,
  body
}: Request): Promise<void> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }

  const bodyMessage = body ? formatBody(body, ticket.contact) : "";
  const type = resolveMediaType(media.mimetype);
  const fileName = path.basename(media.path);
  const publicUrl = `${process.env.BACKEND_URL}/public/${fileName}`;

  try {
    const messageId =
      (await sendIaSolutionMedia({
        whatsapp,
        to: ticket.contact.number,
        type,
        link: publicUrl,
        caption: bodyMessage,
        filename: media.originalname
      })) || `${new Date().getTime()}`;

    await CreateMessageService({
      messageData: {
        id: messageId,
        ticketId: ticket.id,
        body: bodyMessage || media.originalname,
        fromMe: true,
        read: true,
        mediaType: type,
        mediaUrl: fileName,
        ack: 1
      },
      companyId: ticket.companyId
    });

    await ticket.update({ lastMessage: bodyMessage || media.originalname });
  } catch (err: any) {
    Sentry.captureException(err);
    console.log(
      "SendMediaMessageIaSolution error:",
      err?.response?.data || err?.message || err
    );
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendMediaMessageIaSolution;
