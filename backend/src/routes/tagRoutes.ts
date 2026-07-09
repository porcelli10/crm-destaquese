import express from "express";
import isAuth from "../middleware/isAuth";
import tokenAuth from "../middleware/tokenAuth";

import * as TagController from "../controllers/TagController";

const tagRoutes = express.Router();

// API externa: atribui uma tag a um contato pelo numero.
// Autenticacao via header "Authorization: Bearer <TOKEN>", onde <TOKEN> e o
// token da CONEXAO do WhatsApp (visto na tela de Conexoes do painel) — e o
// mesmo token que identifica de qual conexao/empresa parte a requisicao.
tagRoutes.post("/api/tags/add", tokenAuth, TagController.addTagApi);

tagRoutes.get("/tags/list", isAuth, TagController.list);

tagRoutes.get("/tags", isAuth, TagController.index);

tagRoutes.get("/tags/kanban", isAuth, TagController.kanban);

tagRoutes.post("/tags", isAuth, TagController.store);

tagRoutes.put("/tags/reorder", isAuth, TagController.reorder);

tagRoutes.put("/tags/:tagId", isAuth, TagController.update);

tagRoutes.get("/tags/:tagId", isAuth, TagController.show);

tagRoutes.delete("/tags/:tagId", isAuth, TagController.remove);

tagRoutes.post("/tags/sync", isAuth, TagController.syncTags);


export default tagRoutes;
