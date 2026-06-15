import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";

interface Request {
  name: string;
  number: string;
  tagId?: number;
  companyId: number;
}

/**
 * Cria manualmente um "card" do Kanban: vincula/cria o contato pelo número,
 * abre (ou reaproveita) o atendimento e aplica a tag da coluna escolhida.
 *
 * NÃO exige uma conexão de WhatsApp conectada — o card pode ser um lead.
 * Se houver alguma conexão na empresa, ela é apenas vinculada (whatsappId);
 * caso contrário o atendimento é criado sem conexão (whatsappId nulo).
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

  const contact = await CreateOrUpdateContactService({
    name: name || cleanNumber,
    number: cleanNumber,
    profilePicUrl: "",
    isGroup: false,
    companyId
  });

  // Usa qualquer conexão da empresa só para vincular (opcional). Não exige conexão.
  const whatsapp = await Whatsapp.findOne({ where: { companyId } });

  // Reaproveita um atendimento aberto/pendente do contato; senão, cria um novo.
  let ticket = await Ticket.findOne({
    where: {
      contactId: contact.id,
      companyId,
      status: { [Op.or]: ["open", "pending"] }
    },
    order: [["updatedAt", "DESC"]]
  });

  if (!ticket) {
    ticket = await Ticket.create({
      contactId: contact.id,
      companyId,
      status: "open",
      isGroup: false,
      unreadMessages: 0,
      whatsappId: whatsapp ? whatsapp.id : null
    } as any);
    await ticket.reload();
  }

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
