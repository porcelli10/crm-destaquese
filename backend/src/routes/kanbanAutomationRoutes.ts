import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as KanbanAutomationController from "../controllers/KanbanAutomationController";

const kanbanAutomationRoutes = Router();

kanbanAutomationRoutes.get(
  "/kanban-automations",
  isAuth,
  KanbanAutomationController.index
);

kanbanAutomationRoutes.post(
  "/kanban-automations/trigger",
  isAuth,
  KanbanAutomationController.trigger
);

kanbanAutomationRoutes.post(
  "/kanban-automations",
  isAuth,
  KanbanAutomationController.store
);

kanbanAutomationRoutes.put(
  "/kanban-automations/:id",
  isAuth,
  KanbanAutomationController.update
);

kanbanAutomationRoutes.delete(
  "/kanban-automations/:id",
  isAuth,
  KanbanAutomationController.remove
);

export default kanbanAutomationRoutes;
