import { Op } from "sequelize";
import EmitTicketUpdate from "./EmitTicketUpdate";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import TicketCustomField from "../../models/TicketCustomField";

interface FieldInput {
  name: string;
  value: string;
}

interface Request {
  whatsappId: number;
  number?: string;
  ticketId?: number;
  /** aceita objeto { chave: valor } ou array [{ name, value }] */
  fields: Record<string, any> | FieldInput[];
}

const normalizeFields = (
  fields: Record<string, any> | FieldInput[]
): FieldInput[] => {
  if (Array.isArray(fields)) {
    return fields
      .filter(f => f && f.name)
      .map(f => ({ name: String(f.name).trim(), value: String(f.value ?? "") }));
  }
  if (fields && typeof fields === "object") {
    return Object.keys(fields).map(k => ({
      name: k.trim(),
      value: String(fields[k] ?? "")
    }));
  }
  return [];
};

/**
 * Define/atualiza campos personalizados de um card (ticket). Usado pela API
 * externa (autenticada pelo token da conexão). O ticket é localizado pelo
 * ticketId (se informado) ou pelo número do contato (atendimento ativo).
 */
const SetTicketCustomFieldsService = async ({
  whatsappId,
  number,
  ticketId,
  fields
}: Request) => {
  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp) {
    throw new AppError("Não foi possível realizar a operação", 404);
  }
  const { companyId } = whatsapp;

  const parsedFields = normalizeFields(fields);
  if (!parsedFields.length) {
    throw new AppError("Nenhum campo informado", 400);
  }

  // Localiza o ticket (card)
  let ticket: Ticket | null = null;

  if (ticketId) {
    ticket = await Ticket.findOne({ where: { id: ticketId, companyId } });
  } else {
    if (!number) {
      throw new AppError("Informe o número ou o ticketId", 400);
    }
    const validNumber = String(number).replace(/\D/g, "");
    const contact = await Contact.findOne({
      where: { number: validNumber, companyId }
    });
    if (!contact) {
      throw new AppError("Contato não encontrado", 404);
    }

    ticket =
      (await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId,
          status: { [Op.or]: ["open", "pending"] }
        },
        order: [["id", "DESC"]]
      })) ||
      (await Ticket.findOne({
        where: { contactId: contact.id, companyId },
        order: [["id", "DESC"]]
      }));
  }

  if (!ticket) {
    throw new AppError("Nenhum atendimento encontrado para este card", 404);
  }

  // Upsert de cada campo (por ticketId + name)
  const result: TicketCustomField[] = [];
  for (const f of parsedFields) {
    const [record] = await TicketCustomField.findOrCreate({
      where: { ticketId: ticket.id, name: f.name },
      defaults: {
        ticketId: ticket.id,
        companyId,
        name: f.name,
        value: f.value
      } as any
    });
    if (record.value !== f.value) {
      await record.update({ value: f.value });
    }
    result.push(record);
  }

  await EmitTicketUpdate(ticket.id, companyId);

  return { ticket, fields: result };
};

export default SetTicketCustomFieldsService;
