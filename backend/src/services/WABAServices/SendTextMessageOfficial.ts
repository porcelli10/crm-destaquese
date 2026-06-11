import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { sendOfficialText } from "./whatsappOfficialApi";
import DispatchOfficialIntegration from "./DispatchOfficialIntegration";

interface Request {
  body: string;
  ticket: Ticket;
}

/**
 * Envia uma mensagem de texto pela API Oficial (Meta Cloud API) e persiste o
 * registro localmente, pois a Cloud API não devolve "echo" das mensagens
 * enviadas (diferente do Baileys).
 */
const SendTextMessageOfficial = async ({
  body,
  ticket
}: Request): Promise<void> => {
  // Garante que temos as credenciais da conexão carregadas
  // Busca a conexão completa (o ticket.whatsapp do ShowTicketService não traz
  // o token por segurança).
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }

  const formattedBody = formatBody(body, ticket.contact);

  try {
    const wamid = await sendOfficialText({
      whatsapp,
      to: ticket.contact.number,
      body: formattedBody
    });

    await CreateMessageService({
      messageData: {
        id: wamid,
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

    // Encaminha a mensagem enviada para a integração n8n/webhook (best-effort)
    await DispatchOfficialIntegration({
      whatsapp,
      ticket,
      message: { id: wamid, body: formattedBody, fromMe: true, mediaType: "conversation" }
    });
  } catch (err: any) {
    Sentry.captureException(err);
    console.log(
      "SendTextMessageOfficial error:",
      err?.response?.data || err?.message || err
    );
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendTextMessageOfficial;
