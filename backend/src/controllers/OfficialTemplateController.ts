import { Request, Response } from "express";
import { Op } from "sequelize";
import axios from "axios";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import SendTemplateMessageOfficial from "../services/WABAServices/SendTemplateMessageOfficial";
import { listOfficialTemplates } from "../services/WABAServices/whatsappOfficialApi";
import SendTemplateMessageIaSolution from "../services/IaSolutionServices/SendTemplateMessageIaSolution";
import {
  listIaSolutionTemplates,
  syncIaSolutionTemplates,
  createIaSolutionTemplate
} from "../services/IaSolutionServices/iaSolutionApi";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";

// Canais que suportam envio de message templates.
const TEMPLATE_CHANNELS = ["official", "iasolution"];

/**
 * Lista os templates de uma conexão de acordo com o canal (official via Graph
 * API da Meta; iasolution via Hub). Retorna sempre no formato do CRM.
 */
const listTemplatesByChannel = async (whatsapp: Whatsapp): Promise<any[]> => {
  if (whatsapp.channel === "iasolution") {
    return listIaSolutionTemplates(whatsapp);
  }
  return listOfficialTemplates(whatsapp);
};

/**
 * Envia um template pelo serviço correto conforme o canal do ticket.
 */
const sendTemplateByChannel = async (params: {
  ticket: any;
  templateName: string;
  languageCode: string;
  components?: any[];
  previewBody?: string;
}): Promise<void> => {
  if (params.ticket.whatsapp?.channel === "iasolution") {
    await SendTemplateMessageIaSolution(params);
    return;
  }
  await SendTemplateMessageOfficial(params);
};

/**
 * Lista as conexões oficiais da empresa já com o número de telefone real
 * (display_phone_number), buscado na Graph API. Não retorna o token.
 * GET /official-connections
 */
export const connections = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const list = await Whatsapp.findAll({
    where: { companyId, channel: { [Op.in]: TEMPLATE_CHANNELS } },
    attributes: [
      "id",
      "name",
      "channel",
      "officialPhoneNumberId",
      "officialApiVersion",
      "officialAccessToken"
    ]
  });

  const result = await Promise.all(
    list.map(async (w: any) => {
      // iasolution: não há Graph API nem número armazenado; mostra só o nome.
      if (w.channel === "iasolution") {
        return {
          id: w.id,
          name: w.name,
          channel: w.channel,
          displayPhoneNumber: null
        };
      }

      let displayPhoneNumber: string | null = null;
      try {
        const ver = w.officialApiVersion || "v21.0";
        const { data } = await axios.get(
          `https://graph.facebook.com/${ver}/${w.officialPhoneNumberId}`,
          {
            params: { fields: "display_phone_number,verified_name" },
            headers: { Authorization: `Bearer ${w.officialAccessToken}` },
            timeout: 10000
          }
        );
        displayPhoneNumber = data?.display_phone_number || null;
      } catch (err) {
        // token pode estar expirado; cai no fallback (sem número)
      }
      return {
        id: w.id,
        name: w.name,
        channel: w.channel,
        displayPhoneNumber
      };
    })
  );

  return res.json(result);
};

/**
 * Lista os message templates aprovados da conexão oficial informada.
 * GET /official-templates/:whatsappId
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp || whatsapp.companyId !== companyId) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (!TEMPLATE_CHANNELS.includes(whatsapp.channel)) {
    throw new AppError("Conexão não suporta envio de templates", 400);
  }

  try {
    const templates = await listTemplatesByChannel(whatsapp);
    // só faz sentido enviar os aprovados
    const approved = templates.filter((t: any) => t.status === "APPROVED");
    return res.json(approved);
  } catch (err: any) {
    throw new AppError(
      err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "Não foi possível carregar os templates"
    );
  }
};

/**
 * Cria um novo template na conexão (apenas iaSolution: o Hub cria na Meta e já
 * sincroniza localmente). O template nasce PENDING até a aprovação da Meta.
 * POST /official-templates/create
 * body: { whatsappId, name, category, language, components }
 */
export const create = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId, name, category, language, components } = req.body;

  if (!whatsappId || !name || !category || !language || !components?.length) {
    throw new AppError(
      "whatsappId, name, category, language e components são obrigatórios",
      400
    );
  }

  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp || whatsapp.companyId !== companyId) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (whatsapp.channel !== "iasolution") {
    throw new AppError(
      "Criação de template pelo painel disponível apenas para conexões iaSolution. Para o canal oficial, use o Gerenciador da Meta.",
      400
    );
  }

  try {
    const template = await createIaSolutionTemplate({
      whatsapp,
      name,
      category,
      language,
      components
    });
    return res.json({
      message: "Template criado. Aguarde a aprovação da Meta.",
      template
    });
  } catch (err: any) {
    throw new AppError(
      err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "Não foi possível criar o template"
    );
  }
};

/**
 * Força a sincronização dos templates da conexão e devolve a lista atualizada
 * (aprovados). Para iasolution, dispara o sync no Hub (busca da Meta); para
 * official, apenas relista ao vivo da Graph API.
 * POST /official-templates/:whatsappId/sync
 */
export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp || whatsapp.companyId !== companyId) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (!TEMPLATE_CHANNELS.includes(whatsapp.channel)) {
    throw new AppError("Conexão não suporta envio de templates", 400);
  }

  try {
    const templates =
      whatsapp.channel === "iasolution"
        ? await syncIaSolutionTemplates(whatsapp)
        : await listOfficialTemplates(whatsapp);
    const approved = templates.filter((t: any) => t.status === "APPROVED");
    return res.json(approved);
  } catch (err: any) {
    throw new AppError(
      err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "Não foi possível sincronizar os templates"
    );
  }
};

/**
 * Envia um template por um ticket do canal oficial.
 * POST /official-templates/:ticketId/send
 * body: { templateName, languageCode, components?, previewBody? }
 */
export const send = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;
  const { templateName, languageCode, components, previewBody } = req.body;

  if (!templateName || !languageCode) {
    throw new AppError("templateName e languageCode são obrigatórios", 400);
  }

  const ticket = await ShowTicketService(ticketId, companyId);

  if (!TEMPLATE_CHANNELS.includes(ticket.whatsapp?.channel)) {
    throw new AppError(
      "O atendimento não é de uma conexão que suporta templates",
      400
    );
  }

  await sendTemplateByChannel({
    ticket,
    templateName,
    languageCode,
    components,
    previewBody
  });

  return res.json({ message: "Template enviado" });
};

/**
 * Envia um template escolhendo a conexão (remetente) e o número de destino,
 * criando o contato/ticket se necessário. Usado para iniciar conversas.
 * POST /official-templates/send-to
 * body: { whatsappId, number, templateName, languageCode, components?, previewBody? }
 */
export const sendTo = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const {
    whatsappId,
    number,
    templateName,
    languageCode,
    components,
    previewBody
  } = req.body;

  if (!whatsappId || !number || !templateName || !languageCode) {
    throw new AppError(
      "whatsappId, number, templateName e languageCode são obrigatórios",
      400
    );
  }

  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp || whatsapp.companyId !== companyId) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (!TEMPLATE_CHANNELS.includes(whatsapp.channel)) {
    throw new AppError("Conexão não suporta envio de templates", 400);
  }

  const cleanNumber = String(number).replace(/\D/g, "");

  const contact = await CreateOrUpdateContactService({
    name: cleanNumber,
    number: cleanNumber,
    isGroup: false,
    companyId,
    whatsappId: whatsapp.id
  });

  const ticketBase = await FindOrCreateTicketService(
    contact,
    whatsapp.id,
    0,
    companyId
  );

  // recarrega com as associações (contact, channel) para o envio
  const ticket = await ShowTicketService(ticketBase.id, companyId);

  await sendTemplateByChannel({
    ticket,
    templateName,
    languageCode,
    components,
    previewBody
  });

  return res.json({ message: "Template enviado", ticketId: ticket.id });
};
