import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as OfficialTemplateController from "../controllers/OfficialTemplateController";

const officialTemplateRoutes = Router();

officialTemplateRoutes.get(
  "/official-connections",
  isAuth,
  OfficialTemplateController.connections
);

officialTemplateRoutes.post(
  "/official-templates/send-to",
  isAuth,
  OfficialTemplateController.sendTo
);

officialTemplateRoutes.get(
  "/official-templates/:whatsappId",
  isAuth,
  OfficialTemplateController.index
);

officialTemplateRoutes.post(
  "/official-templates/:whatsappId/sync",
  isAuth,
  OfficialTemplateController.sync
);

officialTemplateRoutes.post(
  "/official-templates/:ticketId/send",
  isAuth,
  OfficialTemplateController.send
);

export default officialTemplateRoutes;
