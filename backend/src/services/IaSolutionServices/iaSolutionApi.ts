import axios from "axios";
import Whatsapp from "../../models/Whatsapp";

/**
 * Cliente HTTP para o iaSolution Hub (wrapper da WhatsApp Cloud API).
 * Base: https://apihub.iasolution.app/api/v1
 * Autenticação: Authorization: Bearer <token_do_canal> (Whatsapp.iasolutionToken)
 *
 * Os payloads seguem o formato da WhatsApp Cloud API (image.link, audio.link,
 * document.link, etc.). O envio devolve { success, data: { message_id } }.
 */

const API_BASE =
  process.env.IASOLUTION_API_URL || "https://apihub.iasolution.app/api/v1";

const buildClient = (whatsapp: Whatsapp) =>
  axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${whatsapp.iasolutionToken}`,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });

interface SendTextParams {
  whatsapp: Whatsapp;
  to: string;
  body: string;
  previewUrl?: boolean;
}

/** Envia mensagem de texto. Retorna o message_id (wamid). */
export const sendIaSolutionText = async ({
  whatsapp,
  to,
  body,
  previewUrl = true
}: SendTextParams): Promise<string> => {
  const client = buildClient(whatsapp);
  const { data } = await client.post("/messages/text", {
    to,
    text: body,
    preview_url: previewUrl
  });
  return data?.data?.message_id;
};

interface SendTemplateParams {
  whatsapp: Whatsapp;
  to: string;
  templateName: string;
  languageCode: string;
  /** componentes opcionais (variáveis de header/body/botões) */
  components?: any[];
}

/**
 * Normaliza um template do Hub para o mesmo formato que o CRM usa no canal
 * oficial: { name, status, language (string), category, components }.
 * O Hub sincroniza os templates da Meta, então já vêm nesse formato; ainda
 * assim garantimos `language` como string (aceita string ou { code }).
 */
const normalizeTemplate = (t: any) => ({
  name: t?.name,
  status: (t?.status || "").toString().toUpperCase(),
  language:
    typeof t?.language === "object" ? t?.language?.code : t?.language,
  category: t?.category,
  components: t?.components || []
});

/**
 * Lista os message templates do canal (via Hub). Retorna no formato do CRM.
 * GET /templates -> { success, data: { templates: [...] } }
 */
export const listIaSolutionTemplates = async (
  whatsapp: Whatsapp
): Promise<any[]> => {
  const client = buildClient(whatsapp);
  const { data } = await client.get("/templates");
  const templates = data?.data?.templates || [];
  return templates.map(normalizeTemplate);
};

/**
 * Força a sincronização dos templates a partir da Meta e retorna a lista
 * atualizada no formato do CRM.
 * POST /templates/sync -> { success, data: { synced_count, templates: [...] } }
 */
export const syncIaSolutionTemplates = async (
  whatsapp: Whatsapp
): Promise<any[]> => {
  const client = buildClient(whatsapp);
  const { data } = await client.post("/templates/sync", {});
  const templates = data?.data?.templates || [];
  return templates.map(normalizeTemplate);
};

/**
 * Envia uma mensagem de template aprovado. Único tipo que pode iniciar conversa
 * fora da janela de 24h. Retorna o message_id (wamid).
 * POST /messages/template
 */
export const sendIaSolutionTemplate = async ({
  whatsapp,
  to,
  templateName,
  languageCode,
  components
}: SendTemplateParams): Promise<string> => {
  const client = buildClient(whatsapp);

  const template: any = {
    name: templateName,
    language: { code: languageCode }
  };
  if (components && components.length) {
    template.components = components;
  }

  const { data } = await client.post("/messages/template", { to, template });
  return data?.data?.message_id;
};

interface SendMediaParams {
  whatsapp: Whatsapp;
  to: string;
  /** "image" | "audio" | "video" | "document" */
  type: string;
  /** URL pública da mídia (link) */
  link: string;
  caption?: string;
  filename?: string;
}

/**
 * Envia uma mídia por URL pública. O objeto segue o formato Cloud API:
 * { to, <type>: { link, caption?, filename? } }. Retorna o message_id.
 */
export const sendIaSolutionMedia = async ({
  whatsapp,
  to,
  type,
  link,
  caption,
  filename
}: SendMediaParams): Promise<string> => {
  const client = buildClient(whatsapp);

  const mediaObject: any = { link };
  // caption é suportada em image, video e document (não em audio)
  if (caption && type !== "audio") {
    mediaObject.caption = caption;
  }
  if (type === "document" && filename) {
    mediaObject.filename = filename;
  }

  const { data } = await client.post(`/messages/${type}`, {
    to,
    [type]: mediaObject
  });

  return data?.data?.message_id;
};

/**
 * Baixa o conteúdo binário de uma mídia recebida a partir do `download_url`
 * entregue no webhook (messages[].download_url). A URL exige o Bearer do canal.
 */
export const downloadIaSolutionMedia = async (
  whatsapp: Whatsapp,
  downloadUrl: string
): Promise<{ buffer: Buffer; mimeType: string }> => {
  const { data, headers } = await axios.get(downloadUrl, {
    headers: { Authorization: `Bearer ${whatsapp.iasolutionToken}` },
    responseType: "arraybuffer",
    timeout: 60000
  });
  const contentType = headers["content-type"];
  return {
    buffer: Buffer.from(data),
    mimeType:
      (Array.isArray(contentType) ? contentType[0] : contentType)?.toString() ||
      "application/octet-stream"
  };
};

/** Marca uma mensagem recebida como lida (best-effort). */
export const markIaSolutionMessageRead = async (
  whatsapp: Whatsapp,
  messageId: string
): Promise<void> => {
  try {
    const client = buildClient(whatsapp);
    await client.post(`/messages/${encodeURIComponent(messageId)}/read`, {});
  } catch {
    // best-effort; não interrompe o fluxo
  }
};
