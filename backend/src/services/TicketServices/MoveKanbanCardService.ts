import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import RunEnterAutomationsService from "../KanbanAutomationServices/RunEnterAutomationsService";

interface Request {
  whatsappId: number;
  number?: string;
  ticketId?: number;
  /** nome da coluna (tag kanban) de destino */
  column?: string;
  /** id da tag/coluna de destino (alternativa ao nome) */
  tagId?: number;
}

/**
 * Move um card (ticket) para uma coluna do pipeline (tag kanban). Usado pela
 * API externa (autenticada pelo token da conexão). O card é localizado pelo
 * ticketId ou pelo número (atendimento ativo). Dispara as automações "ao
 * entrar" da coluna de destino.
 */
const MoveKanbanCardService = async ({
  whatsappId,
  number,
  ticketId,
  column,
  tagId
}: Request) => {
  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp) {
    throw new AppError("Não foi possível realizar a operação", 404);
  }
  const { companyId } = whatsapp;

  // Localiza a coluna (tag) de destino por id ou por nome.
  let targetTag: Tag | null = null;
  if (tagId) {
    targetTag = await Tag.findOne({ where: { id: tagId, companyId } });
  } else if (column) {
    targetTag = await Tag.findOne({
      where: {
        companyId,
        kanban: 1,
        name: { [Op.iLike]: String(column).trim() }
      }
    });
    // fallback: qualquer tag com esse nome
    if (!targetTag) {
      targetTag = await Tag.findOne({
        where: { companyId, name: { [Op.iLike]: String(column).trim() } }
      });
    }
  } else {
    throw new AppError("Informe a coluna (column) ou tagId de destino", 400);
  }

  if (!targetTag) {
    throw new AppError("Coluna de destino não encontrada", 404);
  }

  // Localiza o card (ticket).
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

  // Remove o card das outras colunas (tags kanban) e adiciona na coluna destino.
  const columns = await Tag.findAll({ where: { companyId, kanban: 1 } });
  const otherColumnIds = columns
    .map(c => c.id)
    .filter(id => id !== targetTag!.id);

  if (otherColumnIds.length) {
    await TicketTag.destroy({
      where: { ticketId: ticket.id, tagId: { [Op.in]: otherColumnIds } }
    });
  }

  const already = await TicketTag.findOne({
    where: { ticketId: ticket.id, tagId: targetTag.id }
  });
  if (!already) {
    await TicketTag.create({
      ticketId: ticket.id,
      tagId: targetTag.id
    } as any);
  }

  // Dispara automações "ao entrar" da coluna destino (best-effort).
  RunEnterAutomationsService({
    ticketId: ticket.id,
    tagId: targetTag.id,
    companyId,
    event: "on_enter"
  });

  return { ticket, column: targetTag };
};

export default MoveKanbanCardService;
