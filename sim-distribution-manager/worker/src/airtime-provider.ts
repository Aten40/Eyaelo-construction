/**
 * Eyaelo SIM Manager airtime-provider adapter.
 *
 * This module deliberately defaults to sandbox. It never claims a sandbox
 * result changed a real SIM balance. Store credentials as Cloudflare Worker
 * secrets; never commit them or place them in wrangler vars.
 */
export interface AirtimeProviderEnv {
  AIRTIME_PROVIDER_MODE?: "sandbox" | "live";
  RELOADLY_TEST_CLIENT_ID?: string;
  RELOADLY_TEST_CLIENT_SECRET?: string;
  RELOADLY_LIVE_CLIENT_ID?: string;
  RELOADLY_LIVE_CLIENT_SECRET?: string;
}

export interface ReloadlyOperator {
  id: number;
  operatorId?: number;
  name: string;
  country?: { isoName?: string; name?: string };
  bundle?: boolean;
  data?: boolean;
  denominationType?: string;
  [key: string]: unknown;
}

export interface ReloadlyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class AirtimeProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = "AirtimeProviderError";
  }
}

function credentials(env: AirtimeProviderEnv) {
  const live = env.AIRTIME_PROVIDER_MODE === "live";
  const clientId = live ? env.RELOADLY_LIVE_CLIENT_ID : env.RELOADLY_TEST_CLIENT_ID;
  const clientSecret = live ? env.RELOADLY_LIVE_CLIENT_SECRET : env.RELOADLY_TEST_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new AirtimeProviderError(
      live
        ? "Live Reloadly credentials are not configured."
        : "Sandbox Reloadly credentials are not configured.",
      503,
      "provider_not_configured",
    );
  }
  return {
    live,
    clientId,
    clientSecret,
    apiBase: live ? "https://topups.reloadly.com" : "https://topups-sandbox.reloadly.com",
    authUrl: "https://auth.reloadly.com/oauth/token",
  };
}

async function providerJson<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let data: unknown = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { message: "Provider returned an unreadable response." };
  }
  if (!response.ok) {
    const detail = data && typeof data === "object" && "message" in data
      ? String((data as { message: unknown }).message).slice(0, 240)
      : "Provider request failed.";
    throw new AirtimeProviderError(detail, response.status);
  }
  return data as T;
}

export async function getReloadlyToken(env: AirtimeProviderEnv): Promise<string> {
  const c = credentials(env);
  const response = await fetch(c.authUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: "client_credentials",
      audience: c.apiBase,
    }),
  });
  const token = await providerJson<ReloadlyToken>(response);
  if (!token.access_token) throw new AirtimeProviderError("Provider did not return an access token.", 502);
  return token.access_token;
}

export async function listSouthAfricanOperators(env: AirtimeProviderEnv): Promise<ReloadlyOperator[]> {
  const c = credentials(env);
  const token = await getReloadlyToken(env);
  const response = await fetch(c.apiBase + "/operators/countries/ZA?includeBundles=true&includeData=true", {
    headers: {
      authorization: "Bearer " + token,
      accept: "application/com.reloadly.topups-v1+json",
    },
  });
  const payload = await providerJson<ReloadlyOperator[] | { content?: ReloadlyOperator[] }>(response);
  const items = Array.isArray(payload) ? payload : payload.content || [];
  // Return only public operator catalogue fields required by the app.
  return items.map((o) => ({
    id: Number(o.operatorId ?? o.id),
    operatorId: Number(o.operatorId ?? o.id),
    name: String(o.name || "Unknown operator").slice(0, 120),
    country: o.country,
    bundle: Boolean(o.bundle),
    data: Boolean(o.data),
    denominationType: typeof o.denominationType === "string" ? o.denominationType : undefined,
  }));
}

export interface AirtimeTopUpRequest {
  operatorId: number;
  amount: string;
  customIdentifier: string;
  phoneNumber: string;
  countryCode?: string;
}

export interface AirtimeTopUpResponse {
  transactionId: number;
  status?: string;
  customIdentifier?: string;
  operatorId?: number;
  operatorName?: string;
  recipientPhone?: string | number;
  requestedAmount?: number;
  requestedAmountCurrencyCode?: string;
  deliveredAmount?: number;
  deliveredAmountCurrencyCode?: string;
  [key: string]: unknown;
}

/**
 * Sends a real order only when explicitly configured in live mode.
 * Callers must persist a pending record before calling this function and must
 * never blindly retry a timeout (query status/reconcile first).
 */
export async function createReloadlyTopUp(
  env: AirtimeProviderEnv,
  input: AirtimeTopUpRequest,
): Promise<AirtimeTopUpResponse> {
  const c = credentials(env);
  if (!Number.isSafeInteger(input.operatorId) || input.operatorId <= 0) {
    throw new AirtimeProviderError("A valid provider operator ID is required.", 400);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(input.amount) || Number(input.amount) <= 0) {
    throw new AirtimeProviderError("Amount must be a positive decimal value.", 400);
  }
  if (!/^\+?[0-9]{8,15}$/.test(input.phoneNumber)) {
    throw new AirtimeProviderError("Recipient phone number is invalid.", 400);
  }
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(input.customIdentifier)) {
    throw new AirtimeProviderError("A unique custom transaction identifier is required.", 400);
  }
  const token = await getReloadlyToken(env);
  const response = await fetch(c.apiBase + "/topups", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      accept: "application/com.reloadly.topups-v1+json",
    },
    body: JSON.stringify({
      operatorId: String(input.operatorId),
      amount: input.amount,
      useLocalAmount: true,
      customIdentifier: input.customIdentifier,
      recipientPhone: {
        countryCode: input.countryCode || "ZA",
        number: input.phoneNumber.replace(/^\+/, ""),
      },
    }),
  });
  return providerJson<AirtimeTopUpResponse>(response);
}

export async function getReloadlyTopUpStatus(
  env: AirtimeProviderEnv,
  transactionId: number,
): Promise<AirtimeTopUpResponse> {
  const c = credentials(env);
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
    throw new AirtimeProviderError("A valid provider transaction ID is required.", 400);
  }
  const token = await getReloadlyToken(env);
  const response = await fetch(c.apiBase + "/topups/" + transactionId + "/status", {
    headers: {
      authorization: "Bearer " + token,
      accept: "application/com.reloadly.topups-v1+json",
    },
  });
  return providerJson<AirtimeTopUpResponse>(response);
}

export function providerMode(env: AirtimeProviderEnv): "sandbox" | "live" {
  return env.AIRTIME_PROVIDER_MODE === "live" ? "live" : "sandbox";
}
