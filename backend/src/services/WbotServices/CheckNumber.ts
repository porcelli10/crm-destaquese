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

  // Canal oficial (Meta Cloud API) não possui sessão Baileys nem onWhatsApp().
  // Retornamos o próprio número como jid válido, sem checar via Baileys.
  if (defaultWhatsapp.channel === "official") {
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
