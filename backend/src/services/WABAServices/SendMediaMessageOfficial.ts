import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { sendOfficialMedia, uploadOfficialMedia } from "./whatsappOfficialApi";
import DispatchOfficialIntegration from "./DispatchOfficialIntegration";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

/**
 * Converte o mimetype do arquivo no tipo de mídia esperado pela Cloud API.
 */
const resolveOfficialType = (mimetype: string): string => {
  const primary = mimetype.split("/")[0];
  if (primary === "image") return "image";
  if (primary === "video") return "video";
  if (primary === "audio") return "audio";
  return "document";
};

const SendMediaMessageOfficial = async ({
  media,
  ticket,
  body
}: Request): Promise<void> => {
  // Busca a conexão completa (o ticket.whatsapp do ShowTicketService não traz
  // o token por segurança).
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }

  const bodyMessage = body ? formatBody(body, ticket.contact) : "";
  const type = resolveOfficialType(media.mimetype);

  try {
    const fileBuffer = fs.readFileSync(media.path);

    const mediaId = await uploadOfficialMedia({
      whatsapp,
      fileBuffer,
      mimetype: media.mimetype,
      filename: media.originalname
    });

    const wamid = await sendOfficialMedia({
      whatsapp,
      to: ticket.contact.number,
      type,
      mediaId,
      caption: bodyMessage,
      filename: media.originalname
    });

    await CreateMessageService({
      messageData: {
        id: wamid,
        ticketId: ticket.id,
        body: bodyMessage || media.originalname,
        fromMe: true,
        read: true,
        mediaType: type,
        // o arquivo já foi salvo pelo multer na pasta public
        mediaUrl: path.basename(media.path),
        ack: 1
      },
      companyId: ticket.companyId
    });

    await ticket.update({ lastMessage: bodyMessage || media.originalname });

    // Encaminha a mídia enviada para a integração n8n/webhook (best-effort)
    await DispatchOfficialIntegration({
      whatsapp,
      ticket,
      message: {
        id: wamid,
        body: bodyMessage || media.originalname,
        fromMe: true,
        mediaType: type,
        mediaUrl: path.basename(media.path)
      }
    });
  } catch (err: any) {
    Sentry.captureException(err);
    console.log(
      "SendMediaMessageOfficial error:",
      err?.response?.data || err?.message || err
    );
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendMediaMessageOfficial;
