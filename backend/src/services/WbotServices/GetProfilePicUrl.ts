import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";

const GetProfilePicUrl = async (
  number: string,
  companyId: number
): Promise<string> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  const defaultPic = `${process.env.FRONTEND_URL}/nopicture.png`;

  // Canais sem sessão Baileys (official / hub / iasolution) não possuem
  // wbot.profilePictureUrl. Retorna a foto padrão sem tentar o Baileys —
  // antes o getWbot() estourava (ERR_WAPP_NOT_INITIALIZED) e derrubava o
  // envio via /api/messages/send.
  if (defaultWhatsapp.channel !== "baileys") {
    return defaultPic;
  }

  // getWbot() também fica dentro do try: se a sessão Baileys não estiver
  // pronta, cai na foto padrão em vez de quebrar o fluxo.
  try {
    const wbot = getWbot(defaultWhatsapp.id);
    return await wbot.profilePictureUrl(`${number}@s.whatsapp.net`);
  } catch (error) {
    return defaultPic;
  }
};

export default GetProfilePicUrl;
