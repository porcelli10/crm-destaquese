import { logger } from "../../utils/logger";
import KanbanAutomation from "../../models/KanbanAutomation";
import ExecuteAutomationActionsService from "./ExecuteAutomationActionsService";

export const parseJson = (raw: string): any => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Converte uma automação LEGADA (trigger/action/config) em lista de ações.
const legacyActions = (auto: KanbanAutomation): any[] => {
  const cfg = parseJson(auto.config) || {};
  if (auto.action === "message") return [{ type: "message", body: cfg.body }];
  if (auto.action === "template")
    return [
      {
        type: "template",
        templateName: cfg.templateName,
        languageCode: cfg.languageCode
      }
    ];
  if (auto.action === "webhook")
    return [{ type: "webhook", webhookUrl: cfg.webhookUrl }];
  if (auto.action === "move")
    return [{ type: "move_column", targetTagId: cfg.targetTagId }];
  return [];
};

/**
 * Retorna as ações a executar para um dado evento ("on_enter" | "on_leave"),
 * ou null se a automação não dispara nesse evento. Suporta o schema novo
 * (triggers/actions JSON) e o legado (trigger/action/config).
 */
export const resolveActionsForEvent = (
  auto: KanbanAutomation,
  event: string
): any[] | null => {
  const triggers = parseJson(auto.triggers);
  if (Array.isArray(triggers)) {
    const hit = triggers.some((t: any) => t && t.type === event);
    if (!hit) return null;
    const actions = parseJson(auto.actions);
    return Array.isArray(actions) ? actions : [];
  }
  // Legado: só "on_enter"
  if (event === "on_enter" && auto.trigger === "on_enter") {
    return legacyActions(auto);
  }
  return null;
};

interface Request {
  ticketId: number;
  tagId: number;
  companyId: number;
  /** "on_enter" (padrão) | "on_leave" */
  event?: string;
}

/**
 * Executa as automações de uma coluna para um ticket ao entrar/sair dela.
 * Best-effort: nunca lança (não bloqueia o card).
 */
const RunEnterAutomationsService = async ({
  ticketId,
  tagId,
  companyId,
  event = "on_enter"
}: Request): Promise<void> => {
  const automations = await KanbanAutomation.findAll({
    where: { companyId, tagId, active: true }
  });
  if (!automations.length) return;

  for (const auto of automations) {
    const actions = resolveActionsForEvent(auto, event);
    if (!actions) continue;
    try {
      await ExecuteAutomationActionsService(actions, ticketId, companyId);
    } catch (err: any) {
      logger.error(
        `RunEnterAutomations (${event}, auto ${auto.id}) falhou: ${
          err?.message || err
        }`
      );
    }
  }
};

export default RunEnterAutomationsService;
