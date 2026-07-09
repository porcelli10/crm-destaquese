import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";
import TicketCustomField from "../models/TicketCustomField";
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

// GET /ticket-custom-fields/:ticketId  (isAuth) — lista os campos de um card
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { ticketId } = req.params;

  const fields = await TicketCustomField.findAll({
    where: { ticketId, companyId },
    order: [["id", "ASC"]]
  });

  return res.json(fields);
};

// POST /ticket-custom-fields/:ticketId  (isAuth) — cria/atualiza um campo
export const upsert = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { ticketId } = req.params;
  const { name, value } = req.body as { name: string; value: string };

  if (!name || !name.trim()) {
    throw new AppError("O nome do campo é obrigatório", 400);
  }

  const ticket = await Ticket.findOne({ where: { id: ticketId, companyId } });
  if (!ticket) {
    throw new AppError("Atendimento não encontrado", 404);
  }

  const [record] = await TicketCustomField.findOrCreate({
    where: { ticketId: Number(ticketId), name: name.trim() },
    defaults: {
      ticketId: Number(ticketId),
      companyId,
      name: name.trim(),
      value: value ?? ""
    } as any
  });

  if (record.value !== value) {
    await record.update({ value: value ?? "" });
  }

  return res.status(200).json(record);
};

// DELETE /ticket-custom-fields/:id  (isAuth) — remove um campo
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const record = await TicketCustomField.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("Campo não encontrado", 404);
  }

  await record.destroy();

  return res.json({ message: "Campo removido" });
};
