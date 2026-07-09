import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";

interface Request {
  whatsappId: number;
  number?: string;
  ticketId?: number;
}

interface Lead {
  id: number;
  column: string | null;
  number: string;
  name: string;
}

/**
 * Retorna as informações do lead (card): id do atendimento, coluna do pipeline,
 * número e nome. Usado pela API externa (token da conexão). O lead é localizado
 * pelo ticketId ou pelo número (atendimento ativo, senão o mais recente).
 */
const GetKanbanLeadService = async ({
  whatsappId,
  number,
  ticketId
}: Request): Promise<Lead> => {
  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp) {
    throw new AppError("Não foi possível realizar a operação", 404);
  }
  const { companyId } = whatsapp;

  let ticket: Ticket | null = null;
  let contact: Contact | null = null;

  if (ticketId) {
    ticket = await Ticket.findOne({
      where: { id: ticketId, companyId },
      include: [{ model: Contact, as: "contact" }]
    });
    contact = ticket?.contact || null;
  } else {
    if (!number) {
      throw new AppError("Informe o número ou o ticketId", 400);
    }
    const validNumber = String(number).replace(/\D/g, "");
    contact = await Contact.findOne({
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

  if (!ticket || !contact) {
    throw new AppError("Nenhum atendimento encontrado para este lead", 404);
  }

  // Coluna do pipeline: tag kanban (kanban=1) associada ao ticket.
  const ticketTags = await TicketTag.findAll({
    where: { ticketId: ticket.id }
  });
  const tagIds = ticketTags.map(tt => tt.tagId);

  let column: string | null = null;
  if (tagIds.length) {
    const columnTag = await Tag.findOne({
      where: { id: { [Op.in]: tagIds }, companyId, kanban: 1 },
      order: [["id", "DESC"]]
    });
    column = columnTag ? columnTag.name : null;
  }

  return {
    id: ticket.id,
    column,
    number: contact.number,
    name: contact.name
  };
};

export default GetKanbanLeadService;
