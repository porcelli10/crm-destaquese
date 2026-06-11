import { Request, Response } from "express";
import axios from "axios";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import SendTemplateMessageOfficial from "../services/WABAServices/SendTemplateMessageOfficial";
import { listOfficialTemplates } from "../services/WABAServices/whatsappOfficialApi";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";

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
    where: { companyId, channel: "official" },
    attributes: [
      "id",
      "name",
      "officialPhoneNumberId",
      "officialApiVersion",
      "officialAccessToken"
    ]
  });

  const result = await Promise.all(
    list.map(async (w: any) => {
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
      return { id: w.id, name: w.name, displayPhoneNumber };
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

  if (whatsapp.channel !== "official") {
    throw new AppError("Conexão não é do tipo WhatsApp API Oficial", 400);
  }

  try {
    const templates = await listOfficialTemplates(whatsapp);
    // só faz sentido enviar os aprovados
    const approved = templates.filter((t: any) => t.status === "APPROVED");
    return res.json(approved);
  } catch (err: any) {
    throw new AppError(
      err?.response?.data?.error?.message ||
        "Não foi possível carregar os templates da Meta"
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

  if (ticket.whatsapp?.channel !== "official") {
    throw new AppError("O atendimento não é de uma conexão oficial", 400);
  }

  await SendTemplateMessageOfficial({
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

  if (whatsapp.channel !== "official") {
    throw new AppError("Conexão não é do tipo WhatsApp API Oficial", 400);
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

  await SendTemplateMessageOfficial({
    ticket,
    templateName,
    languageCode,
    components,
    previewBody
  });

  return res.json({ message: "Template enviado", ticketId: ticket.id });
};
