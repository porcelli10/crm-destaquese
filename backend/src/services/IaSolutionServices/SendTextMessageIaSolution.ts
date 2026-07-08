import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { sendIaSolutionText } from "./iaSolutionApi";

interface Request {
  body: string;
  ticket: Ticket;
}

/**
 * Envia uma mensagem de texto pelo iaSolution Hub e persiste o registro
 * localmente — a API não devolve "echo" das mensagens enviadas.
 */
const SendTextMessageIaSolution = async ({
  body,
  ticket
}: Request): Promise<void> => {
  // Busca a conexão completa (o ticket.whatsapp do ShowTicketService pode não
  // trazer o token por segurança).
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }

  const formattedBody = formatBody(body, ticket.contact);

  try {
    const messageId =
      (await sendIaSolutionText({
        whatsapp,
        to: ticket.contact.number,
        body: formattedBody
      })) || `${new Date().getTime()}`;

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
      "SendTextMessageIaSolution error:",
      err?.response?.data || err?.message || err
    );
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendTextMessageIaSolution;
