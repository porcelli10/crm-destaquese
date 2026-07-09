import axios from "axios";
import { Op } from "sequelize";
import { addMinutes } from "date-fns";
import { getIO } from "../../libs/socket";
import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";
import Ticket from "../../models/Ticket";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import Schedule from "../../models/Schedule";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendTemplateMessageIaSolution from "../IaSolutionServices/SendTemplateMessageIaSolution";
import SendTemplateMessageOfficial from "../WABAServices/SendTemplateMessageOfficial";
import formatBody from "../../helpers/Mustache";

const MAX_DELAY_MS = 5 * 60 * 1000; // teto de segurança para o "Aguardar"
const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, Math.min(Math.max(ms, 0), MAX_DELAY_MS)));

/**
 * Executa, em ordem, uma lista de ações de automação sobre um ticket.
 * Ações suportadas: message, template, webhook, add_tag, remove_tag,
 * move_column, assign_user, delay, create_activity. As demais (funnel,
 * creative, conversion, ai_agent, duplicate) ficam registradas como "em breve".
 * Best-effort: uma ação que falha não interrompe as demais.
 */
const ExecuteAutomationActionsService = async (
  actions: any[],
  ticketId: number,
  companyId: number
): Promise<void> => {
  if (!Array.isArray(actions) || !actions.length) return;

  let ticket = await ShowTicketService(ticketId, companyId);

  for (const a of actions) {
    try {
      switch (a.type) {
        case "message":
          if (a.body) {
            await SendWhatsAppMessage({
              body: formatBody(a.body, ticket.contact),
              ticket
            });
          }
          break;

        case "template":
          if (a.templateName) {
            const params = {
              ticket,
              templateName: a.templateName,
              languageCode: a.languageCode || "pt_BR",
              components: a.components,
              previewBody: a.previewBody
            };
            if (ticket.whatsapp?.channel === "iasolution") {
              await SendTemplateMessageIaSolution(params);
            } else {
              await SendTemplateMessageOfficial(params);
            }
          }
          break;

        case "webhook":
          if (a.webhookUrl) {
            await axios.post(
              a.webhookUrl,
              {
                event: "kanban.automation",
                ticketId: ticket.id,
                ticketUuid: ticket.uuid,
                number: ticket.contact?.number,
                contactName: ticket.contact?.name,
                companyId
              },
              { timeout: 15000 }
            );
          }
          break;

        case "add_tag":
          if (a.tagId) {
            const exists = await TicketTag.findOne({
              where: { ticketId: ticket.id, tagId: a.tagId }
            });
            if (!exists) {
              await TicketTag.create({
                ticketId: ticket.id,
                tagId: a.tagId
              } as any);
            }
          }
          break;

        case "remove_tag":
          if (a.tagId) {
            await TicketTag.destroy({
              where: { ticketId: ticket.id, tagId: a.tagId }
            });
          }
          break;

        case "move_column":
          if (a.targetTagId) {
            const columns = await Tag.findAll({ where: { companyId, kanban: 1 } });
            const colIds = columns
              .map(c => c.id)
              .filter(id => id !== Number(a.targetTagId));
            if (colIds.length) {
              await TicketTag.destroy({
                where: { ticketId: ticket.id, tagId: { [Op.in]: colIds } }
              });
            }
            const exists = await TicketTag.findOne({
              where: { ticketId: ticket.id, tagId: a.targetTagId }
            });
            if (!exists) {
              await TicketTag.create({
                ticketId: ticket.id,
                tagId: a.targetTagId
              } as any);
            }
          }
          break;

        case "assign_user":
          if (a.userId) {
            await ticket.update({ userId: a.userId });
          }
          break;

        case "delay":
          await sleep((Number(a.seconds) || 0) * 1000);
          // recarrega o ticket após a espera (estado pode ter mudado)
          ticket = await ShowTicketService(ticketId, companyId);
          break;

        case "create_activity":
          await Schedule.create({
            body: a.body || "Atividade (automação)",
            sendAt: addMinutes(new Date(), Number(a.minutes) || 60),
            contactId: ticket.contactId,
            ticketId: ticket.id,
            companyId,
            status: "PENDENTE"
          } as any);
          break;

        default:
          logger.info(
            `KanbanAutomation: ação "${a.type}" ainda não implementada (ticket ${ticket.id})`
          );
      }
    } catch (err: any) {
      Sentry.captureException(err);
      logger.error(
        `KanbanAutomation ação "${a.type}" falhou: ${
          err?.response?.data?.message || err?.message || err
        }`
      );
    }
  }

  // Atualiza o Kanban em tempo real após executar as ações.
  try {
    getIO()
      .to(`company-${companyId}-mainchannel`)
      .emit("tag", { action: "update" });
  } catch {
    // best-effort
  }
};

export default ExecuteAutomationActionsService;
