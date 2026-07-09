import axios from "axios";
import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";
import KanbanAutomation from "../../models/KanbanAutomation";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendTemplateMessageIaSolution from "../IaSolutionServices/SendTemplateMessageIaSolution";
import SendTemplateMessageOfficial from "../WABAServices/SendTemplateMessageOfficial";
import formatBody from "../../helpers/Mustache";

interface Request {
  ticketId: number;
  tagId: number;
  companyId: number;
}

const parseConfig = (raw: string): any => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Executa as automações do tipo "on_enter" de uma coluna (tag) para um ticket
 * que acabou de entrar nela. Best-effort: nunca lança (não bloqueia o card).
 */
const RunEnterAutomationsService = async ({
  ticketId,
  tagId,
  companyId
}: Request): Promise<void> => {
  const automations = await KanbanAutomation.findAll({
    where: { companyId, tagId, trigger: "on_enter", active: true }
  });

  if (!automations.length) return;

  let ticket;
  try {
    ticket = await ShowTicketService(ticketId, companyId);
  } catch (err) {
    logger.error(`KanbanAutomation: ticket ${ticketId} não encontrado`);
    return;
  }

  for (const automation of automations) {
    const config = parseConfig(automation.config);
    try {
      if (automation.action === "message" && config.body) {
        await SendWhatsAppMessage({
          body: formatBody(config.body, ticket),
          ticket
        });
      } else if (automation.action === "template" && config.templateName) {
        const params = {
          ticket,
          templateName: config.templateName,
          languageCode: config.languageCode || "pt_BR",
          components: config.components,
          previewBody: config.previewBody
        };
        if (ticket.whatsapp?.channel === "iasolution") {
          await SendTemplateMessageIaSolution(params);
        } else {
          await SendTemplateMessageOfficial(params);
        }
      } else if (automation.action === "webhook" && config.webhookUrl) {
        await axios.post(
          config.webhookUrl,
          {
            event: "kanban.card.entered",
            tagId,
            ticketId: ticket.id,
            ticketUuid: ticket.uuid,
            number: ticket.contact?.number,
            contactName: ticket.contact?.name,
            queueId: ticket.queueId,
            userId: ticket.userId,
            companyId
          },
          { timeout: 15000 }
        );
      }
    } catch (err: any) {
      Sentry.captureException(err);
      logger.error(
        `KanbanAutomation on_enter (id ${automation.id}) falhou: ${
          err?.response?.data?.message || err?.message || err
        }`
      );
    }
  }
};

export default RunEnterAutomationsService;
