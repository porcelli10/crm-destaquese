import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import CheckContactNumber from "../WbotServices/CheckNumber";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";

interface Request {
  whatsappId: number;
  number: string;
  tag: string;
  color?: string;
}

/**
 * Atribui uma tag ao atendimento de um contato identificado pelo número.
 * Usado pela API externa (autenticada pelo token do WhatsApp).
 * Se a tag ainda não existir na empresa, ela é criada automaticamente.
 */
const AddTagToContactService = async ({
  whatsappId,
  number,
  tag,
  color
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

  const checkNumber = await CheckContactNumber(String(number), companyId);
  const validNumber = checkNumber.jid.replace(/\D/g, "");

  const contact = await CreateOrUpdateContactService({
    name: `${validNumber}`,
    number: validNumber,
    profilePicUrl: "",
    isGroup: false,
    companyId
  });

  // Uma tag é apenas metadado do atendimento: NÃO deve criar um ticket novo
  // nem alterar status/fila. Por isso procuramos o atendimento existente do
  // contato em vez de usar FindOrCreateTicketService (que duplicava o ticket
  // e o jogava para "aguardando").
  // Preferimos o atendimento ativo (aberto/aguardando); se não houver, usamos
  // o mais recente (mesmo fechado) sem reabri-lo.
  let ticket = await Ticket.findOne({
    where: {
      contactId: contact.id,
      companyId,
      status: { [Op.or]: ["open", "pending"] }
    },
    order: [["id", "DESC"]]
  });

  if (!ticket) {
    ticket = await Ticket.findOne({
      where: {
        contactId: contact.id,
        companyId
      },
      order: [["id", "DESC"]]
    });
  }

  if (!ticket) {
    throw new AppError(
      "Nenhum atendimento encontrado para este contato",
      404
    );
  }

  const tagName = String(tag).trim();

  let tagRecord = await Tag.findOne({
    where: { name: tagName, companyId }
  });

  if (!tagRecord) {
    tagRecord = await Tag.create({
      name: tagName,
      color: color || "#5C59A0",
      companyId,
      kanban: 0
    } as any);
  }

  const existing = await TicketTag.findOne({
    where: { ticketId: ticket.id, tagId: tagRecord.id }
  });

  if (!existing) {
    await TicketTag.create({
      ticketId: ticket.id,
      tagId: tagRecord.id
    } as any);
  }

  return {
    ticket,
    contact,
    tag: tagRecord,
    alreadyTagged: Boolean(existing)
  };
};

export default AddTagToContactService;
