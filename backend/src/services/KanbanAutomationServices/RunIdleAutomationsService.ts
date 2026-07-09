import { Op } from "sequelize";
import { subDays } from "date-fns";
import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";
import KanbanAutomation from "../../models/KanbanAutomation";
import TicketTag from "../../models/TicketTag";
import Ticket from "../../models/Ticket";
import RunEnterAutomationsService from "./RunEnterAutomationsService";

const parseConfig = (raw: string): any => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Percorre as automações "idle" (card parado X dias) e move os tickets que
 * excederam o tempo de inatividade para a coluna de destino. Ao mover, dispara
 * as automações "on_enter" da coluna destino (permitindo alerta/mensagem).
 * Rodado periodicamente pelo monitor (Bull). Best-effort por automação.
 */
const RunIdleAutomationsService = async (): Promise<void> => {
  const automations = await KanbanAutomation.findAll({
    where: { trigger: "idle", action: "move", active: true }
  });

  for (const automation of automations) {
    const config = parseConfig(automation.config);
    const idleDays = Number(config.idleDays);
    const targetTagId = Number(config.targetTagId);

    if (!idleDays || !targetTagId || targetTagId === automation.tagId) continue;

    const cutoff = subDays(new Date(), idleDays);

    try {
      // tickets atualmente na coluna de origem
      const ticketTags = await TicketTag.findAll({
        where: { tagId: automation.tagId }
      });
      const ticketIds = ticketTags.map(tt => tt.ticketId);
      if (!ticketIds.length) continue;

      const staleTickets = await Ticket.findAll({
        where: {
          id: { [Op.in]: ticketIds },
          companyId: automation.companyId,
          status: { [Op.or]: ["open", "pending"] },
          updatedAt: { [Op.lt]: cutoff }
        }
      });

      for (const ticket of staleTickets) {
        try {
          // move: remove a tag da coluna de origem e adiciona a de destino
          await TicketTag.destroy({
            where: { ticketId: ticket.id, tagId: automation.tagId }
          });
          const exists = await TicketTag.findOne({
            where: { ticketId: ticket.id, tagId: targetTagId }
          });
          if (!exists) {
            await TicketTag.create({
              ticketId: ticket.id,
              tagId: targetTagId
            } as any);
          }

          // dispara as automações da coluna destino (alerta/mensagem)
          await RunEnterAutomationsService({
            ticketId: ticket.id,
            tagId: targetTagId,
            companyId: automation.companyId
          });
        } catch (err: any) {
          Sentry.captureException(err);
          logger.error(
            `KanbanAutomation idle: falha ao mover ticket ${ticket.id}: ${
              err?.message || err
            }`
          );
        }
      }
    } catch (err: any) {
      Sentry.captureException(err);
      logger.error(
        `KanbanAutomation idle (id ${automation.id}) falhou: ${
          err?.message || err
        }`
      );
    }
  }
};

export default RunIdleAutomationsService;
