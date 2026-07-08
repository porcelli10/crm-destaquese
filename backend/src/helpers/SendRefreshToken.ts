import { Response } from "express";

// Frontend e backend ficam em subdomínios/origens diferentes (ex.:
// crm-destaquese... e apicrm...). Para o navegador ENVIAR o cookie do refresh
// token em requisições cross-origin com credenciais, ele precisa de
// `SameSite=None; Secure` (só sobre HTTPS). Em dev (http/localhost) usamos
// `lax` sem secure, senão o cookie nem é gravado.
const isSecure =
  process.env.NODE_ENV === "production" ||
  (process.env.BACKEND_URL || "").startsWith("https");

export const SendRefreshToken = (res: Response, token: string): void => {
  res.cookie("jrt", token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax"
  });
};
