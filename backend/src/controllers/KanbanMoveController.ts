import { Request, Response } from "express";
import MoveKanbanCardService from "../services/TicketServices/MoveKanbanCardService";

/**
 * API externa (autenticada pelo token da CONEXÃO via tokenAuth): move um card
 * (ticket) para uma coluna do pipeline (tag kanban).
 *
 * POST /api/kanban/move
 * headers: Authorization: Bearer <TOKEN DA CONEXÃO>
 * body: { number?, ticketId?, column?, tagId? }
 *   - identifica o card por ticketId ou pelo número (atendimento ativo)
 *   - identifica a coluna por nome (column) ou tagId
 */
export const moveViaApi = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params as unknown as { whatsappId: number };
  const { number, ticketId, column, tagId } = req.body as {
    number?: string;
    ticketId?: number;
    column?: string;
    tagId?: number;
  };

  const { ticket, column: target } = await MoveKanbanCardService({
    whatsappId,
    number,
    ticketId,
    column,
    tagId
  });

  return res.status(200).json({
    message: "Card movido com sucesso",
    ticketId: ticket.id,
    column: { id: target.id, name: target.name }
  });
};
