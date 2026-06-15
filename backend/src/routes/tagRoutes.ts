import express from "express";
import isAuth from "../middleware/isAuth";
import tokenAuth from "../middleware/tokenAuth";

import * as TagController from "../controllers/TagController";

const tagRoutes = express.Router();

// API externa: atribui uma tag a um contato pelo numero (auth via token do WhatsApp)
tagRoutes.post("/api/tags/add", tokenAuth, TagController.addTagApi);

tagRoutes.get("/tags/list", isAuth, TagController.list);

tagRoutes.get("/tags", isAuth, TagController.index);

tagRoutes.get("/tags/kanban", isAuth, TagController.kanban);

tagRoutes.post("/tags", isAuth, TagController.store);

tagRoutes.put("/tags/:tagId", isAuth, TagController.update);

tagRoutes.get("/tags/:tagId", isAuth, TagController.show);

tagRoutes.delete("/tags/:tagId", isAuth, TagController.remove);

tagRoutes.post("/tags/sync", isAuth, TagController.syncTags);


export default tagRoutes;
