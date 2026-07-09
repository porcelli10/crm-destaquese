import { Request, Response } from "express";
import AppError from "../errors/AppError";
import KanbanAutomation from "../models/KanbanAutomation";
import RunEnterAutomationsService from "../services/KanbanAutomationServices/RunEnterAutomationsService";

// GET /kanban-automations?tagId=
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { tagId } = req.query as { tagId?: string };

  const where: any = { companyId };
  if (tagId) where.tagId = Number(tagId);

  const automations = await KanbanAutomation.findAll({
    where,
    order: [["id", "ASC"]]
  });

  return res.json(automations);
};

const asJson = (v: any) =>
  v === undefined ? undefined : typeof v === "string" ? v : JSON.stringify(v);

// POST /kanban-automations
export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const {
    tagId,
    name,
    description,
    triggers,
    actions,
    settings,
    active,
    // legado
    trigger,
    action,
    config
  } = req.body;

  if (!tagId) {
    throw new AppError("tagId é obrigatório", 400);
  }

  // Aceita o schema novo (triggers/actions) ou o legado (trigger/action).
  const isNew = Array.isArray(triggers) || Array.isArray(actions);
  if (!isNew && (!trigger || !action)) {
    throw new AppError(
      "Informe triggers/actions (novo) ou trigger/action (legado)",
      400
    );
  }

  const automation = await KanbanAutomation.create({
    companyId,
    tagId,
    name: name || null,
    description: description || null,
    triggers: asJson(triggers) || null,
    actions: asJson(actions) || null,
    settings: asJson(settings) || null,
    trigger: trigger || null,
    action: action || null,
    config: asJson(config) || null,
    active: active !== false
  } as any);

  return res.status(201).json(automation);
};

// PUT /kanban-automations/:id
export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const {
    name,
    description,
    triggers,
    actions,
    settings,
    active,
    trigger,
    action,
    config
  } = req.body;

  const automation = await KanbanAutomation.findOne({
    where: { id, companyId }
  });
  if (!automation) throw new AppError("Automação não encontrada", 404);

  await automation.update({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(triggers !== undefined && { triggers: asJson(triggers) }),
    ...(actions !== undefined && { actions: asJson(actions) }),
    ...(settings !== undefined && { settings: asJson(settings) }),
    ...(trigger !== undefined && { trigger }),
    ...(action !== undefined && { action }),
    ...(config !== undefined && { config: asJson(config) }),
    ...(active !== undefined && { active })
  });

  return res.json(automation);
};

// DELETE /kanban-automations/:id
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const automation = await KanbanAutomation.findOne({
    where: { id, companyId }
  });
  if (!automation) throw new AppError("Automação não encontrada", 404);

  await automation.destroy();

  return res.json({ message: "Automação removida" });
};

// POST /kanban-automations/trigger  body: { ticketId, tagId }
// Chamado pelo frontend após mover um card para uma coluna.
export const trigger = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { ticketId, tagId, sourceTagId } = req.body;

  if (!ticketId || !tagId) {
    throw new AppError("ticketId e tagId são obrigatórios", 400);
  }

  // Entrada na coluna de destino (best-effort, não bloqueia a resposta)
  RunEnterAutomationsService({
    ticketId: Number(ticketId),
    tagId: Number(tagId),
    companyId,
    event: "on_enter"
  });

  // Saída da coluna de origem (se informada)
  if (sourceTagId && Number(sourceTagId) !== Number(tagId)) {
    RunEnterAutomationsService({
      ticketId: Number(ticketId),
      tagId: Number(sourceTagId),
      companyId,
      event: "on_leave"
    });
  }

  return res.json({ message: "Automações disparadas" });
};
