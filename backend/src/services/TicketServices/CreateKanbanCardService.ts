import AppError from "../../errors/AppError";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "./FindOrCreateTicketService";

interface Request {
  name: string;
  number: string;
  tagId?: number;
  companyId: number;
}

/**
 * Cria manualmente um "card" do Kanban: vincula/cria o contato pelo número,
 * abre (ou reaproveita) o atendimento e aplica a tag da coluna escolhida.
 * Idempotente quanto à tag (não duplica a associação).
 */
const CreateKanbanCardService = async ({
  name,
  number,
  tagId,
  companyId
}: Request) => {
  if (!name) {
    throw new AppError("O nome é obrigatório", 400);
  }
  if (!number) {
    throw new AppError("O número é obrigatório", 400);
  }

  const cleanNumber = String(number).replace(/\D/g, "");
  if (!cleanNumber) {
    throw new AppError("Número inválido", 400);
  }

  const whatsapp = await GetDefaultWhatsApp(companyId);

  const contact = await CreateOrUpdateContactService({
    name: name || cleanNumber,
    number: cleanNumber,
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

  if (tagId) {
    const tag = await Tag.findOne({ where: { id: tagId, companyId } });
    if (tag) {
      await TicketTag.findOrCreate({
        where: { ticketId: ticket.id, tagId: tag.id },
        defaults: { ticketId: ticket.id, tagId: tag.id } as any
      });
    }
  }

  return { ticket, contact };
};

export default CreateKanbanCardService;
