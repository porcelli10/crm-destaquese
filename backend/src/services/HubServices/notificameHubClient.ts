import { Client, TextContent, FileContent } from "notificamehubsdk";
import Whatsapp from "../../models/Whatsapp";

/**
 * Cliente do NotificaMe Hub (WhatsApp / Facebook / Instagram via API unificada).
 * Cada conexão (Whatsapp) traz o próprio token e o tipo de canal (hubChannel),
 * permitindo múltiplas contas/canais por empresa.
 *
 * O SDK (notificamehubsdk) é JS puro/ofuscado; a interface usada aqui é:
 *   const client = new Client(token);
 *   const channel = client.setChannel("whatsapp" | "facebook" | "instagram");
 *   await channel.sendMessage(from, to, new TextContent(text));
 *   await channel.sendMessage(from, to, new FileContent(url, mime, caption, name));
 */

export { TextContent, FileContent };

/** Retorna o cliente do canal (whatsapp/facebook/instagram) já configurado. */
export const getHubChannel = (whatsapp: Whatsapp) => {
  if (!whatsapp.hubToken) {
    throw new Error("Conexão Hub sem token configurado (hubToken).");
  }
  const client = new Client(whatsapp.hubToken);
  return client.setChannel(whatsapp.hubChannel || "whatsapp");
};

/** Cliente "cru" do Hub, para operações de conta (ex.: assinaturas de webhook). */
export const getHubClient = (token: string): Client => new Client(token);
