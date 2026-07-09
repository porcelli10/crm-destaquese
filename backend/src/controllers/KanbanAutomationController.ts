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

// POST /kanban-automations
export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { tagId, trigger, action, config, active } = req.body;

  if (!tagId || !trigger || !action) {
    throw new AppError("tagId, trigger e action são obrigatórios", 400);
  }

  const automation = await KanbanAutomation.create({
    companyId,
    tagId,
    trigger,
    action,
    config: typeof config === "string" ? config : JSON.stringify(config || {}),
    active: active !== false
  } as any);

  return res.status(201).json(automation);
};

// PUT /kanban-automations/:id
export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const { trigger, action, config, active } = req.body;

  const automation = await KanbanAutomation.findOne({
    where: { id, companyId }
  });
  if (!automation) throw new AppError("Automação não encontrada", 404);

  await automation.update({
    ...(trigger !== undefined && { trigger }),
    ...(action !== undefined && { action }),
    ...(config !== undefined && {
      config: typeof config === "string" ? config : JSON.stringify(config)
    }),
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
  const { ticketId, tagId } = req.body;

  if (!ticketId || !tagId) {
    throw new AppError("ticketId e tagId são obrigatórios", 400);
  }

  // best-effort: não bloqueia a resposta
  RunEnterAutomationsService({
    ticketId: Number(ticketId),
    tagId: Number(tagId),
    companyId
  });

  return res.json({ message: "Automações disparadas" });
};
