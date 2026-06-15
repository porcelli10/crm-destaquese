import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import CheckContactNumber from "../WbotServices/CheckNumber";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";

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

  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp.id,
    0,
    companyId
  );

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
