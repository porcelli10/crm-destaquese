import axios from "axios";
import Whatsapp from "../../models/Whatsapp";

/**
 * Cliente HTTP para a API Oficial do WhatsApp (Meta Cloud API / Graph API).
 * Toda comunicação usa as credenciais armazenadas na própria conexão (Whatsapp),
 * permitindo múltiplas contas oficiais por empresa.
 */

const GRAPH_BASE = "https://graph.facebook.com";

const getApiVersion = (whatsapp: Whatsapp): string =>
  whatsapp.officialApiVersion || "v21.0";

const buildClient = (whatsapp: Whatsapp) => {
  const version = getApiVersion(whatsapp);
  return axios.create({
    baseURL: `${GRAPH_BASE}/${version}`,
    headers: {
      Authorization: `Bearer ${whatsapp.officialAccessToken}`,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });
};

interface SendTextParams {
  whatsapp: Whatsapp;
  to: string;
  body: string;
}

/**
 * Envia uma mensagem de texto. Retorna o wamid (id da mensagem na Meta).
 */
export const sendOfficialText = async ({
  whatsapp,
  to,
  body
}: SendTextParams): Promise<string> => {
  const client = buildClient(whatsapp);
  const { data } = await client.post(
    `/${whatsapp.officialPhoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: true, body }
    }
  );

  return data?.messages?.[0]?.id;
};

interface SendTemplateParams {
  whatsapp: Whatsapp;
  to: string;
  templateName: string;
  languageCode: string;
  /** componentes opcionais (variáveis do corpo, botões, etc.) */
  components?: any[];
}

/**
 * Lista os message templates aprovados da conta (WABA). Usado para o usuário
 * escolher qual template enviar para iniciar uma conversa.
 */
export const listOfficialTemplates = async (
  whatsapp: Whatsapp
): Promise<any[]> => {
  const version = getApiVersion(whatsapp);
  const { data } = await axios.get(
    `${GRAPH_BASE}/${version}/${whatsapp.officialWabaId}/message_templates`,
    {
      headers: { Authorization: `Bearer ${whatsapp.officialAccessToken}` },
      params: {
        fields: "name,status,language,category,components",
        limit: 200
      },
      timeout: 30000
    }
  );
  return data?.data || [];
};

/**
 * Envia uma mensagem de template (message template) aprovado. É o único tipo de
 * mensagem permitido para iniciar uma conversa fora da janela de 24h. Retorna o
 * wamid.
 */
export const sendOfficialTemplate = async ({
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

  const { data } = await client.post(
    `/${whatsapp.officialPhoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template
    }
  );

  return data?.messages?.[0]?.id;
};

interface SendMediaParams {
  whatsapp: Whatsapp;
  to: string;
  /** "image" | "video" | "audio" | "document" */
  type: string;
  /** id de mídia já carregada na Meta (uploadOfficialMedia) */
  mediaId: string;
  caption?: string;
  filename?: string;
}

/**
 * Envia uma mídia previamente carregada (uploadOfficialMedia). Retorna o wamid.
 */
export const sendOfficialMedia = async ({
  whatsapp,
  to,
  type,
  mediaId,
  caption,
  filename
}: SendMediaParams): Promise<string> => {
  const client = buildClient(whatsapp);

  const mediaObject: any = { id: mediaId };
  // Caption é suportada apenas em image, video e document
  if (caption && type !== "audio") {
    mediaObject.caption = caption;
  }
  if (type === "document" && filename) {
    mediaObject.filename = filename;
  }

  const { data } = await client.post(
    `/${whatsapp.officialPhoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type,
      [type]: mediaObject
    }
  );

  return data?.messages?.[0]?.id;
};

interface UploadMediaParams {
  whatsapp: Whatsapp;
  fileBuffer: Buffer;
  mimetype: string;
  filename: string;
}

/**
 * Faz upload de um arquivo para a Meta e retorna o media id, que pode então
 * ser enviado com sendOfficialMedia.
 */
export const uploadOfficialMedia = async ({
  whatsapp,
  fileBuffer,
  mimetype,
  filename
}: UploadMediaParams): Promise<string> => {
  // Upload usa multipart/form-data, então montamos o client manualmente
  const version = getApiVersion(whatsapp);
  const FormData = require("form-data");
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", fileBuffer, { filename, contentType: mimetype });
  form.append("type", mimetype);

  const { data } = await axios.post(
    `${GRAPH_BASE}/${version}/${whatsapp.officialPhoneNumberId}/media`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${whatsapp.officialAccessToken}`
      },
      maxBodyLength: Infinity,
      timeout: 60000
    }
  );

  return data?.id;
};

/**
 * Resolve a URL temporária de download de uma mídia recebida (a partir do media id).
 */
export const getOfficialMediaUrl = async (
  whatsapp: Whatsapp,
  mediaId: string
): Promise<{ url: string; mimeType: string }> => {
  const client = buildClient(whatsapp);
  const { data } = await client.get(`/${mediaId}`);
  return { url: data?.url, mimeType: data?.mime_type };
};

/**
 * Baixa o conteúdo binário de uma mídia recebida. A URL exige o header de
 * autorização da própria conexão.
 */
export const downloadOfficialMedia = async (
  whatsapp: Whatsapp,
  mediaUrl: string
): Promise<Buffer> => {
  const { data } = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${whatsapp.officialAccessToken}` },
    responseType: "arraybuffer",
    timeout: 60000
  });
  return Buffer.from(data);
};

/**
 * Marca uma mensagem recebida como lida (check azul) na conta oficial.
 */
export const markOfficialMessageRead = async (
  whatsapp: Whatsapp,
  messageId: string
): Promise<void> => {
  try {
    const client = buildClient(whatsapp);
    await client.post(`/${whatsapp.officialPhoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId
    });
  } catch {
    // marcar como lida é best-effort; não deve interromper o fluxo
  }
};
