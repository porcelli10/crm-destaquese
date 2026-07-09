import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { sendIaSolutionTemplate } from "./iaSolutionApi";

interface Request {
  ticket: Ticket;
  templateName: string;
  languageCode: string;
  /** componentes opcionais (variáveis do corpo, etc.) */
  components?: any[];
  /** texto já renderizado do template, para exibir no histórico do CRM */
  previewBody?: string;
}

/**
 * Envia um message template pelo canal iaSolution (Hub) e persiste o registro
 * localmente. Templates são o único tipo de mensagem que pode iniciar uma
 * conversa fora da janela de 24h. Espelha SendTemplateMessageOfficial.
 */
const SendTemplateMessageIaSolution = async ({
  ticket,
  templateName,
  languageCode,
  components,
  previewBody
}: Request): Promise<void> => {
  // Busca a conexão completa (o ticket.whatsapp do ShowTicketService não traz
  // o token por segurança).
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }

  const displayBody = previewBody || `[Template enviado: ${templateName}]`;

  try {
    const wamid = await sendIaSolutionTemplate({
      whatsapp,
      to: ticket.contact.number,
      templateName,
      languageCode,
      components
    });

    await CreateMessageService({
      messageData: {
        id: wamid,
        ticketId: ticket.id,
        body: displayBody,
        fromMe: true,
        read: true,
        mediaType: "conversation",
        ack: 1
      },
      companyId: ticket.companyId
    });

    await ticket.update({ lastMessage: displayBody });
  } catch (err: any) {
    Sentry.captureException(err);
    console.log(
      "SendTemplateMessageIaSolution error:",
      err?.response?.data || err?.message || err
    );
    throw new AppError(
      err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "ERR_SENDING_WAPP_MSG"
    );
  }
};

export default SendTemplateMessageIaSolution;
