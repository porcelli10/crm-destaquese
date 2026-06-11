import axios from "axios";
import { logger } from "../../utils/logger";

/**
 * Serviço do Embedded Signup da Meta (Facebook Login for Business).
 *
 * Fluxo: o frontend abre o popup do Facebook (FB.login com o config_id) e
 * recebe um `code` (authorization code) + as infos da sessão (waba_id e
 * phone_number_id). Esses dados chegam aqui; trocamos o code por um token de
 * acesso do negócio, inscrevemos nosso app na WABA do cliente (para receber os
 * webhooks) e registramos o número na Cloud API.
 *
 * Pré-requisitos no `.env` (raiz):
 *   FACEBOOK_APP_ID        — App ID do app na Meta
 *   FACEBOOK_APP_SECRET    — App Secret (sensível, só backend)
 *   FACEBOOK_GRAPH_VERSION — versão da Graph API (ex: v21.0)
 */

const GRAPH_BASE = "https://graph.facebook.com";

const getVersion = (): string =>
  process.env.FACEBOOK_GRAPH_VERSION || "v21.0";

const getAppId = (): string => process.env.FACEBOOK_APP_ID || "";

const getAppSecret = (): string => process.env.FACEBOOK_APP_SECRET || "";

export interface EmbeddedSignupResult {
  officialWabaId: string;
  officialPhoneNumberId: string;
  officialAccessToken: string;
  officialApiVersion: string;
  /** nome sugerido para a conexão (verified_name ou número exibido) */
  suggestedName: string;
  /** número de telefone legível, quando disponível */
  displayPhoneNumber: string | null;
}

/**
 * Troca o authorization code do Embedded Signup por um token de acesso do
 * negócio. Esse token é usado para falar com a WABA do cliente.
 */
const exchangeCodeForToken = async (code: string): Promise<string> => {
  const version = getVersion();
  const { data } = await axios.get(
    `${GRAPH_BASE}/${version}/oauth/access_token`,
    {
      params: {
        client_id: getAppId(),
        client_secret: getAppSecret(),
        code
      },
      timeout: 30000
    }
  );

  const token = data?.access_token;
  if (!token) {
    throw new Error("Falha ao obter o token de acesso (resposta sem access_token)");
  }
  return token;
};

/**
 * Inscreve nosso app na WABA do cliente, para que os webhooks (mensagens,
 * status) dessa conta passem a chegar no nosso endpoint /webhooks.
 */
const subscribeAppToWaba = async (
  wabaId: string,
  token: string
): Promise<void> => {
  const version = getVersion();
  await axios.post(
    `${GRAPH_BASE}/${version}/${wabaId}/subscribed_apps`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    }
  );
};

/**
 * Registra o número na Cloud API (necessário para conseguir enviar/receber).
 * Best-effort: se o número já estiver registrado, a Meta retorna erro e nós
 * apenas logamos — não deve interromper o cadastro da conexão.
 */
const registerPhoneNumber = async (
  phoneNumberId: string,
  token: string
): Promise<void> => {
  const version = getVersion();
  // PIN de 6 dígitos exigido pelo endpoint /register. Se o número não tiver
  // verificação em duas etapas ativa, qualquer PIN é aceito.
  const pin = process.env.FACEBOOK_REGISTER_PIN || "000000";
  try {
    await axios.post(
      `${GRAPH_BASE}/${version}/${phoneNumberId}/register`,
      { messaging_product: "whatsapp", pin },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      }
    );
  } catch (err: any) {
    logger.warn(
      `EmbeddedSignup: registro do número ${phoneNumberId} não concluído (pode já estar registrado): ${
        err?.response?.data?.error?.message || err.message
      }`
    );
  }
};

/**
 * Busca o número de telefone legível e o nome verificado para sugerir um nome
 * de conexão amigável.
 */
const fetchPhoneInfo = async (
  phoneNumberId: string,
  token: string
): Promise<{ displayPhoneNumber: string | null; verifiedName: string | null }> => {
  const version = getVersion();
  try {
    const { data } = await axios.get(
      `${GRAPH_BASE}/${version}/${phoneNumberId}`,
      {
        params: { fields: "display_phone_number,verified_name" },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      }
    );
    return {
      displayPhoneNumber: data?.display_phone_number || null,
      verifiedName: data?.verified_name || null
    };
  } catch {
    return { displayPhoneNumber: null, verifiedName: null };
  }
};

/**
 * Orquestra o onboarding completo a partir dos dados do Embedded Signup.
 */
const EmbeddedSignupService = async (
  code: string,
  wabaId: string,
  phoneNumberId: string
): Promise<EmbeddedSignupResult> => {
  if (!getAppId() || !getAppSecret()) {
    throw new Error(
      "Embedded Signup não configurado: defina FACEBOOK_APP_ID e FACEBOOK_APP_SECRET no .env do backend."
    );
  }

  const token = await exchangeCodeForToken(code);

  // Inscreve o app na WABA (sem isso, não recebemos webhooks dessa conta).
  await subscribeAppToWaba(wabaId, token);

  // Registra o número (best-effort).
  await registerPhoneNumber(phoneNumberId, token);

  const { displayPhoneNumber, verifiedName } = await fetchPhoneInfo(
    phoneNumberId,
    token
  );

  const suggestedName =
    verifiedName || displayPhoneNumber || `Oficial ${phoneNumberId}`;

  logger.info(
    `EmbeddedSignup concluído: waba=${wabaId} phone=${phoneNumberId} (${displayPhoneNumber || "?"})`
  );

  return {
    officialWabaId: wabaId,
    officialPhoneNumberId: phoneNumberId,
    officialAccessToken: token,
    officialApiVersion: getVersion(),
    suggestedName,
    displayPhoneNumber
  };
};

export default EmbeddedSignupService;
