import { initWASocket } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";
import * as Sentry from "@sentry/node";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  // Canal oficial (Meta Cloud API): não há sessão Baileys nem QR Code.
  // A "conexão" é baseada em token, então marcamos como CONNECTED diretamente.
  if (whatsapp.channel === "official") {
    await whatsapp.update({ status: "CONNECTED", qrcode: "" });
    const ioOfficial = getIO();
    ioOfficial
      .to(`company-${whatsapp.companyId}-mainchannel`)
      .emit(`company-${whatsapp.companyId}-whatsappSession`, {
        action: "update",
        session: whatsapp
      });
    return;
  }

  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.to(`company-${whatsapp.companyId}-mainchannel`).emit("whatsappSession", {
    action: "update",
    session: whatsapp
  });

  try {
    const wbot = await initWASocket(whatsapp);
    wbotMessageListener(wbot, companyId);
    wbotMonitor(wbot, whatsapp, companyId);
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
};
