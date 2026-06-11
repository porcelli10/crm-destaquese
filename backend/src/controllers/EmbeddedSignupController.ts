import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EmbeddedSignupService from "../services/WABAServices/EmbeddedSignupService";

/**
 * Recebe os dados do Embedded Signup da Meta (vindos do popup do Facebook),
 * troca o code por um token, inscreve o app na WABA e registra o número.
 * Retorna as credenciais prontas para o frontend preencher o formulário de
 * criação da conexão (o usuário ainda define nome, filas, etc. e salva).
 *
 * POST /whatsapp/embedded-signup
 * body: { code, wabaId, phoneNumberId }
 */
export const store = async (req: Request, res: Response): Promise<Response> => {
  const { code, wabaId, phoneNumberId } = req.body;

  if (!code || !wabaId || !phoneNumberId) {
    throw new AppError(
      "Dados incompletos do Embedded Signup (code, wabaId e phoneNumberId são obrigatórios).",
      400
    );
  }

  try {
    const result = await EmbeddedSignupService(code, wabaId, phoneNumberId);
    return res.status(200).json(result);
  } catch (err: any) {
    const metaMsg = err?.response?.data?.error?.message;
    throw new AppError(
      metaMsg || err.message || "Falha no Embedded Signup",
      400
    );
  }
};
