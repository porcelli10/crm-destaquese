import Ticket from "../../models/Ticket";
import DispatchAutomationWebhook from "./DispatchAutomationWebhook";

/**
 * Dispara o evento "ticket.accepted" no Webhook de automação (IA) quando um
 * ticket é ACEITO (pending -> open). Best-effort (delega ao dispatcher genérico,
 * que engole erros). Uso típico: pausar um agente de IA para o número do cliente
 * assim que um atendente humano assume o ticket.
 */
const DispatchTicketAcceptedWebhook = async (
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  await DispatchAutomationWebhook(companyId, {
    event: "ticket.accepted",
    number: ticket.contact?.number,
    contactName: ticket.contact?.name,
    ticketId: ticket.id,
    ticketUuid: ticket.uuid,
    queueId: ticket.queueId,
    userId: ticket.userId,
    companyId
  });
};

export default DispatchTicketAcceptedWebhook;
