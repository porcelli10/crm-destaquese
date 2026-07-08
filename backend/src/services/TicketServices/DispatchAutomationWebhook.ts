import axios from "axios";
import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";
import ListSettingsServiceOne from "../SettingServices/ListSettingsServiceOne";

/**
 * Envia (best-effort) um evento para o "Webhook de automação (IA)" configurado
 * no painel em Configurações (Setting key "automationWebhookUrl").
 *
 * Recebe tanto mensagens recebidas (event: "message.received") quanto eventos
 * do CRM (event: "ticket.accepted"). Uso típico: um agente de IA / n8n que
 * responde às mensagens e pausa quando um humano assume o ticket.
 *
 * Nunca lança: qualquer erro é logado e engolido para não afetar o fluxo.
 */
const DispatchAutomationWebhook = async (
  companyId: number,
  payload: Record<string, any>
): Promise<void> => {
  try {
    const setting = await ListSettingsServiceOne({
      companyId,
      key: "automationWebhookUrl"
    });

    const url = setting?.value?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return; // não configurado / URL inválida
    }

    await axios.post(url, payload, { timeout: 15000 });
    logger.info(
      `Automation webhook enviado (${payload?.event}, company ${companyId})`
    );
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(
      `Erro no automation webhook: ${
        err?.response?.data || err?.message || err
      }`
    );
  }
};

export default DispatchAutomationWebhook;
