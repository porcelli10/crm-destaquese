import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { sendOfficialTemplate } from "./whatsappOfficialApi";
import DispatchOfficialIntegration from "./DispatchOfficialIntegration";

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
 * Envia um message template (Meta Cloud API) por um ticket do canal oficial e
 * persiste o registro localmente. Templates são o único tipo de mensagem que
 * pode iniciar uma conversa fora da janela de 24h.
 */
const SendTemplateMessageOfficial = async ({
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
    const wamid = await sendOfficialTemplate({
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

    // Encaminha para a integração n8n/webhook (best-effort)
    await DispatchOfficialIntegration({
      whatsapp,
      ticket,
      message: { id: wamid, body: displayBody, fromMe: true, mediaType: "conversation" }
    });
  } catch (err: any) {
    Sentry.captureException(err);
    console.log(
      "SendTemplateMessageOfficial error:",
      err?.response?.data || err?.message || err
    );
    throw new AppError(
      err?.response?.data?.error?.message || "ERR_SENDING_WAPP_MSG"
    );
  }
};

export default SendTemplateMessageOfficial;
