import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";

const CheckIsValidContact = async (
  number: string,
  companyId: number
): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  // Canal oficial (Meta Cloud API) não possui sessão Baileys nem onWhatsApp().
  // Não há como validar o número via Baileys, então consideramos válido.
  if (defaultWhatsapp.channel === "official") {
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
