import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";

const CheckIsValidContact = async (
  number: string,
  companyId: number
): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  // Canais sem sessão Baileys (API Oficial e Hub NotificaMe) não têm
  // onWhatsApp(). Não há como validar via Baileys, então consideramos válido.
  if (
    defaultWhatsapp.channel === "official" ||
    defaultWhatsapp.channel === "hub" ||
    defaultWhatsapp.channel === "iasolution"
  ) {
    return;
  }

  const wbot = getWbot(defaultWhatsapp.id);

  try {
    const isValidNumber = await wbot.onWhatsApp(`${number}`);
    if (!isValidNumber) {
      throw new AppError("invalidNumber");
    }
  } catch (err: any) {
    if (err.message === "invalidNumber") {
      throw new AppError("ERR_WAPP_INVALID_CONTACT");
    }
    throw new AppError("ERR_WAPP_CHECK_CONTACT");
  }
};

export default CheckIsValidContact;
