import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import { logger } from "../../utils/logger";

interface IOnWhatsapp {
  jid: string;
  exists: boolean;
}

const checker = async (number: string, wbot: any) => {
  const [validNumber] = await wbot.onWhatsApp(`${number}@s.whatsapp.net`);
  return validNumber;
};

const CheckContactNumber = async (
  number: string,
  companyId: number
): Promise<IOnWhatsapp> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  // Canais sem sessão Baileys (API Oficial e Hub NotificaMe) não têm
  // onWhatsApp(). Retornamos o próprio número como jid válido.
  if (
    defaultWhatsapp.channel === "official" ||
    defaultWhatsapp.channel === "hub" ||
    defaultWhatsapp.channel === "iasolution"
  ) {
    return { jid: `${number}@s.whatsapp.net`, exists: true };
  }

  const wbot = getWbot(defaultWhatsapp.id);
  const isNumberExit = await checker(number, wbot);

  if (!isNumberExit) {
    throw new AppError("ERR_CHECK_NUMBER");
  }
  return isNumberExit;
};

export default CheckContactNumber;
