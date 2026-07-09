import { Op } from "sequelize";
import { subDays } from "date-fns";
import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";
import KanbanAutomation from "../../models/KanbanAutomation";
import TicketTag from "../../models/TicketTag";
import Ticket from "../../models/Ticket";
import TicketCustomField from "../../models/TicketCustomField";
import RunEnterAutomationsService, { parseJson } from "./RunEnterAutomationsService";
import ExecuteAutomationActionsService from "./ExecuteAutomationActionsService";

// Tickets atualmente na coluna (tag) que estão inativos há mais de X dias.
const staleTicketsInColumn = async (
  tagId: number,
  companyId: number,
  idleDays: number
): Promise<Ticket[]> => {
  const cutoff = subDays(new Date(), idleDays);
  const ticketTags = await TicketTag.findAll({ where: { tagId } });
  const ticketIds = ticketTags.map(tt => tt.ticketId);
  if (!ticketIds.length) return [];
  return Ticket.findAll({
    where: {
      id: { [Op.in]: ticketIds },
      companyId,
      status: { [Op.or]: ["open", "pending"] },
      updatedAt: { [Op.lt]: cutoff }
    }
  });
};

// Evita repetir a automação para o mesmo período de inatividade: guarda um
// marcador oculto (campo custom "_kbauto_<id>") com o horário da última execução.
// Reexecuta só se o ticket voltou a ter atividade depois do marcador.
const alreadyRan = async (
  automationId: number,
  ticket: Ticket,
  companyId: number
): Promise<boolean> => {
  const marker = await TicketCustomField.findOne({
    where: { ticketId: ticket.id, name: `_kbauto_${automationId}` }
  });
  if (marker && new Date(marker.value) > new Date(ticket.updatedAt)) {
    return true;
  }
  const now = new Date().toISOString();
  if (marker) {
    await marker.update({ value: now });
  } else {
    await TicketCustomField.create({
      ticketId: ticket.id,
      companyId,
      name: `_kbauto_${automationId}`,
      value: now
    } as any);
  }
  return false;
};

/**
 * Executa as automações por tempo (card parado / sem interação). Rodado
 * periodicamente pelo monitor Bull. Trata schema novo e legado. Best-effort.
 */
const RunIdleAutomationsService = async (): Promise<void> => {
  const automations = await KanbanAutomation.findAll({ where: { active: true } });

  for (const auto of automations) {
    try {
      const triggers = parseJson(auto.triggers);

      // ---- Schema novo: gatilhos idle_column / no_interaction ----
      if (Array.isArray(triggers)) {
        const idleTrigger = triggers.find(
          (t: any) =>
            t && (t.type === "idle_column" || t.type === "no_interaction")
        );
        if (!idleTrigger) continue;

        const idleDays = Number(idleTrigger.days) || 1;
        const actions = parseJson(auto.actions) || [];
        const tickets = await staleTicketsInColumn(
          auto.tagId,
          auto.companyId,
          idleDays
        );

        for (const ticket of tickets) {
          if (await alreadyRan(auto.id, ticket, auto.companyId)) continue;
          await ExecuteAutomationActionsService(
            actions,
            ticket.id,
            auto.companyId
          );
        }
        continue;
      }

      // ---- Legado: trigger "idle" + action "move" ----
      if (auto.trigger === "idle" && auto.action === "move") {
        const config = parseJson(auto.config) || {};
        const idleDays = Number(config.idleDays);
        const targetTagId = Number(config.targetTagId);
        if (!idleDays || !targetTagId || targetTagId === auto.tagId) continue;

        const tickets = await staleTicketsInColumn(
          auto.tagId,
          auto.companyId,
          idleDays
        );

        for (const ticket of tickets) {
          await TicketTag.destroy({
            where: { ticketId: ticket.id, tagId: auto.tagId }
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
          await RunEnterAutomationsService({
            ticketId: ticket.id,
            tagId: targetTagId,
            companyId: auto.companyId
          });
        }
      }
    } catch (err: any) {
      Sentry.captureException(err);
      logger.error(
        `KanbanAutomation idle (auto ${auto.id}) falhou: ${err?.message || err}`
      );
    }
  }
};

export default RunIdleAutomationsService;
