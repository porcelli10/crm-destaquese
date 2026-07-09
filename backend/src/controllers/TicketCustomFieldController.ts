import { Request, Response } from "express";
import SetTicketCustomFieldsService from "../services/TicketServices/SetTicketCustomFieldsService";

/**
 * API externa (autenticada pelo token da CONEXÃO via tokenAuth): define/atualiza
 * campos personalizados de um card (ticket) do Kanban.
 *
 * POST /api/kanban/custom-fields
 * headers: Authorization: Bearer <TOKEN DA CONEXÃO>
 * body: { number?, ticketId?, fields }
 *   - fields: objeto { "Valor": "500", "Origem": "Facebook" }
 *             ou array [{ "name": "Valor", "value": "500" }]
 *   - identifica o card por ticketId ou pelo número (atendimento ativo).
 */
export const setViaApi = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params as unknown as { whatsappId: number };
  const { number, ticketId, fields } = req.body as {
    number?: string;
    ticketId?: number;
    fields: any;
  };

  const { ticket, fields: saved } = await SetTicketCustomFieldsService({
    whatsappId,
    number,
    ticketId,
    fields
  });

  return res.status(200).json({
    message: "Campos atualizados com sucesso",
    ticketId: ticket.id,
    fields: saved.map(f => ({ id: f.id, name: f.name, value: f.value }))
  });
};
