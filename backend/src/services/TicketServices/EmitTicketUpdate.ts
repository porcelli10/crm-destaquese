import { getIO } from "../../libs/socket";
import ShowTicketService from "./ShowTicketService";

/**
 * Recarrega o ticket (com tags, contato, fila, etc.) e emite o evento
 * "company-<id>-ticket" (action update) para as salas que as listas de
 * atendimento e o Kanban escutam. Usado após mudar tags do ticket, para
 * refletir em tempo real (sem recarregar a página). Best-effort.
 */
const EmitTicketUpdate = async (
  ticketId: number,
  companyId: number
): Promise<void> => {
  try {
    const ticket = await ShowTicketService(ticketId, companyId);
    const io = getIO();
    io.to(`company-${companyId}-mainchannel`)
      .to(`company-${companyId}-${ticket.status}`)
      .to(`company-${companyId}-notification`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-notification`)
      .to(String(ticketId))
      .to(`user-${ticket.userId}`)
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });
  } catch {
    // best-effort: não interrompe o fluxo
  }
};

export default EmitTicketUpdate;
