import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as EmbeddedSignupController from "../controllers/EmbeddedSignupController";

const embeddedSignupRoutes = Router();

embeddedSignupRoutes.post(
  "/whatsapp/embedded-signup",
  isAuth,
  EmbeddedSignupController.store
);

export default embeddedSignupRoutes;
