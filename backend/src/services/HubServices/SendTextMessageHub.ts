import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { getHubChannel, TextContent } from "./notificameHubClient";

interface Request {
  body: string;
  ticket: Ticket;
}

/**
 * Envia uma mensagem de texto pelo Hub NotificaMe (WhatsApp/Facebook/Instagram)
 * e persiste o registro localmente — a API do Hub não devolve "echo" das
 * mensagens enviadas (assim como a Cloud API oficial).
 */
const SendTextMessageHub = async ({ body, ticket }: Request): Promise<void> => {
  // Busca a conexão completa: o ticket.whatsapp do ShowTicketService pode não
  // trazer as credenciais do Hub.
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }

  const formattedBody = formatBody(body, ticket.contact);

  try {
    const channel = getHubChannel(whatsapp);
    const response = await channel.sendMessage(
      whatsapp.hubFrom,
      ticket.contact.number,
      new TextContent(formattedBody)
    );

    // O id da mensagem no Hub costuma vir em response.id
    const messageId =
      response?.id || response?.messageId || `${new Date().getTime()}`;

    await CreateMessageService({
      messageData: {
        id: messageId,
        ticketId: ticket.id,
        body: formattedBody,
        fromMe: true,
        read: true,
        mediaType: "conversation",
        ack: 1
      },
      companyId: ticket.companyId
    });

    await ticket.update({ lastMessage: formattedBody });
  } catch (err: any) {
    Sentry.captureException(err);
    console.log(
      "SendTextMessageHub error:",
      err?.response?.data || err?.message || err
    );
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendTextMessageHub;
