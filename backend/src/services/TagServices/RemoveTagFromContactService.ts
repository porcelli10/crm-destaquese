import { Op } from "sequelize";
import EmitTicketUpdate from "../TicketServices/EmitTicketUpdate";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";

interface Request {
  whatsappId: number;
  number: string;
  tag: string;
}

/**
 * Remove uma tag do atendimento de um contato identificado pelo número.
 * Usado pela API externa (autenticada pelo token da conexão). Espelha
 * AddTagToContactService.
 */
const RemoveTagFromContactService = async ({
  whatsappId,
  number,
  tag
}: Request) => {
  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp) {
    throw new AppError("Não foi possível realizar a operação", 404);
  }
  const { companyId } = whatsapp;

  if (!number) {
    throw new AppError("O número é obrigatório", 400);
  }
  if (!tag) {
    throw new AppError("A tag é obrigatória", 400);
  }

  const validNumber = String(number).replace(/\D/g, "");
  const contact = await Contact.findOne({
    where: { number: validNumber, companyId }
  });
  if (!contact) {
    throw new AppError("Contato não encontrado", 404);
  }

  // Atendimento ativo (aberto/aguardando); senão o mais recente.
  const ticket =
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

  if (!ticket) {
    throw new AppError("Nenhum atendimento encontrado para este contato", 404);
  }

  const tagRecord = await Tag.findOne({
    where: { name: String(tag).trim(), companyId }
  });

  let removed = false;
  if (tagRecord) {
    const deleted = await TicketTag.destroy({
      where: { ticketId: ticket.id, tagId: tagRecord.id }
    });
    removed = deleted > 0;
  }

  if (removed) {
    await EmitTicketUpdate(ticket.id, companyId);
  }

  return {
    ticket,
    contact,
    tag: tagRecord,
    removed
  };
};

export default RemoveTagFromContactService;
