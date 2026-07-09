import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import AppError from "../errors/AppError";

import CreateService from "../services/TagServices/CreateService";
import ListService from "../services/TagServices/ListService";
import UpdateService from "../services/TagServices/UpdateService";
import ShowService from "../services/TagServices/ShowService";
import DeleteService from "../services/TagServices/DeleteService";
import SimpleListService from "../services/TagServices/SimpleListService";
import SyncTagService from "../services/TagServices/SyncTagsService";
import KanbanListService from "../services/TagServices/KanbanListService";
import AddTagToContactService from "../services/TagServices/AddTagToContactService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string | number;
  kanban?: number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { pageNumber, searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { tags, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId
  });

  return res.json({ tags, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color, kanban } = req.body;
  const { companyId } = req.user;

  const tag = await CreateService({
    name,
    color,
    companyId,
    kanban
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit("tag", {
    action: "create",
    tag
  });

  return res.status(200).json(tag);
};

export const kanban = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const tags = await KanbanListService({ companyId });

  return res.json({lista:tags});
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { tagId } = req.params;

  const tag = await ShowService(tagId);

  return res.status(200).json(tag);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { tagId } = req.params;
  const tagData = req.body;

  const tag = await UpdateService({ tagData, id: tagId });

  const io = getIO();
  io.to(`company-${req.user.companyId}-mainchannel`).emit("tag", {
    action: "update",
    tag
  });

  return res.status(200).json(tag);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tagId } = req.params;

  await DeleteService(tagId);

  const io = getIO();
  io.to(`company-${req.user.companyId}-mainchannel`).emit("tag", {
    action: "delete",
    tagId
  });

  return res.status(200).json({ message: "Tag deleted" });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  const tags = await SimpleListService({ searchParam, companyId });

  return res.json(tags);
};

export const syncTags = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body;
  const { companyId } = req.user;

  const tags = await SyncTagService({ ...data, companyId });

  return res.json(tags);
};

// API externa: atribui uma tag ao atendimento de um contato identificado
// pelo numero.
// Autenticacao (middleware tokenAuth): header "Authorization: Bearer <TOKEN>",
// onde <TOKEN> e o TOKEN DA CONEXAO do WhatsApp (tela de Conexoes). O tokenAuth
// resolve a conexao pelo token e injeta o whatsappId — por isso ele NAO vai na
// URL nem no body.
export const addTagApi = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params as unknown as { whatsappId: number };
  const { number, tag, color } = req.body as {
    number: string;
    tag: string;
    color?: string;
  };

  const result = await AddTagToContactService({
    whatsappId,
    number,
    tag,
    color
  });

  return res.status(200).json({
    message: result.alreadyTagged
      ? "A tag já estava aplicada a este atendimento"
      : "Tag adicionada com sucesso",
    ticketId: result.ticket.id,
    contact: {
      id: result.contact.id,
      number: result.contact.number,
      name: result.contact.name
    },
    tag: {
      id: result.tag.id,
      name: result.tag.name,
      color: result.tag.color
    }
  });
};
