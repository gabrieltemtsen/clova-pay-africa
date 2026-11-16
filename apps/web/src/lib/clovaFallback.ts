import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const PAYCREST_V2_BASE_URL = process.env.PAYCREST_V2_BASE_URL || "https://api.paycrest.io/v2";

// Sender fee percent configured on the Paycrest sender profile (default 2%)
const SENDER_FEE_PCT = Number(process.env.PAYCREST_SENDER_FEE_PCT ?? 2);

const DEFAULT_RATES: Record<string, number> = {
  NGN: 1380,
  KES: 130,
  GHS: 15,
  UGX: 4400,
  TZS: 2650,
  MWK: 1700,
  BRL: 5.7,
  XOF: 600,
  INR: 84,
};

export const ASSET_TO_PAYCREST: Record<string, { token: string; network: string }> = {
  USDC_BASE: { token: "USDC", network: "base" },
  USDT_BASE: { token: "USDT", network: "base" },
  USDC_CELO: { token: "USDC", network: "celo" },
  USDT_CELO: { token: "USDT", network: "celo" },
  // Legacy alias: Paycrest replaced cUSD on Celo with USDT / USDC on Celo
  cUSD_CELO: { token: "USDT", network: "celo" },
  USDC_ARBITRUM: { token: "USDC", network: "arbitrum-one" },
  USDT_ARBITRUM: { token: "USDT", network: "arbitrum-one" },
  USDC_POLYGON: { token: "USDC", network: "polygon" },
  USDT_POLYGON: { token: "USDT", network: "polygon" },
  USDC_ETHEREUM: { token: "USDC", network: "ethereum" },
  USDT_ETHEREUM: { token: "USDT", network: "ethereum" },
  USDT_BSC: { token: "USDT", network: "bnb-smart-chain" },
  USDC_BSC: { token: "USDC", network: "bnb-smart-chain" },
};

function paycrestToAssetKey(token?: string, network?: string): string {
  const t = (token || "USDC").toUpperCase();
  const n = (network || "base").toLowerCase();
  if (n === "base") return t === "USDT" ? "USDT_BASE" : "USDC_BASE";
  if (n === "celo") return t === "USDC" ? "USDC_CELO" : "USDT_CELO";
  if (n === "arbitrum-one" || n === "arbitrum") return t === "USDT" ? "USDT_ARBITRUM" : "USDC_ARBITRUM";
  if (n === "polygon") return t === "USDT" ? "USDT_POLYGON" : "USDC_POLYGON";
  if (n === "ethereum") return t === "USDT" ? "USDT_ETHEREUM" : "USDC_ETHEREUM";
  if (n === "bnb-smart-chain" || n === "bsc") return t === "USDC" ? "USDC_BSC" : "USDT_BSC";
  return `${t}_${n.toUpperCase()}`;
}

export function explorerTxUrl(asset: string, txHash: string): string {
  if (!txHash) return "";
  if (asset.includes("BASE")) return `https://basescan.org/tx/${txHash}`;
  if (asset.includes("CELO")) return `https://celoscan.io/tx/${txHash}`;
  if (asset.includes("ARBITRUM")) return `https://arbiscan.io/tx/${txHash}`;
  if (asset.includes("POLYGON")) return `https://polygonscan.com/tx/${txHash}`;
  if (asset.includes("ETHEREUM")) return `https://etherscan.io/tx/${txHash}`;
  if (asset.includes("BSC")) return `https://bscscan.com/tx/${txHash}`;
  if (asset.includes("STACKS")) return `https://explorer.hiro.so/txid/${txHash}?chain=mainnet`;
  return `https://basescan.org/tx/${txHash}`;
}

// Global in-memory cache (persists across warm invocations on Vercel)
const ordersDb = new Map<string, any>();
const settlementsDb = new Map<string, any>();

let recentPaycrestOrdersCache: { fetchedAt: number; orders: any[]; total: number } | null = null;
let paycrestCurrenciesCache: { fetchedAt: number; data: any[] } | null = null;

function formatPaycrestError(status: number, payload: any, rawText?: string): string {
  const baseMsg = payload?.message || rawText || `HTTP ${status}`;
  if (Array.isArray(payload?.data) && payload.data.length > 0) {
    const details = payload.data
      .map((d: any) => (d?.field ? `${d.field}: ${d.message}` : d?.message || JSON.stringify(d)))
      .join("; ");
    return `${baseMsg} (${details})`;
  }
  if (payload?.data && typeof payload.data === "object" && payload.data.message) {
    const f = payload.data.field ? `${payload.data.field}: ` : "";
    return `${baseMsg} (${f}${payload.data.message})`;
  }
  return baseMsg;
}

export async function paycrestV2PublicRequest(method: "GET" | "POST", path: string, body?: unknown) {
  const apiKey = process.env.PAYCREST_API_KEY || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (apiKey) headers["API-Key"] = apiKey;

  const response = await fetch(`${PAYCREST_V2_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok || payload?.status === "error" || payload?.status === false) {
    throw new Error(formatPaycrestError(response.status, payload, text));
  }

  return payload?.data ?? payload;
}

export async function paycrestV2Request(method: "GET" | "POST", path: string, body?: unknown) {
  const apiKey = process.env.PAYCREST_API_KEY || "";
  if (!apiKey) {
    console.error("[Clova Server] Configuration Error: PAYCREST_API_KEY is not defined in process.env!");
    throw new Error("Service configuration error: PAYCREST_API_KEY is missing.");
  }

  const headers: Record<string, string> = {
    "API-Key": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const response = await fetch(`${PAYCREST_V2_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok || payload?.status === "error" || payload?.status === false) {
    throw new Error(formatPaycrestError(response.status, payload, text));
  }

  return payload?.data ?? payload;
}

async function getPaycrestCurrencies(): Promise<any[]> {
  if (paycrestCurrenciesCache && Date.now() - paycrestCurrenciesCache.fetchedAt < 60_000) {
    return paycrestCurrenciesCache.data;
  }
  try {
    const data = await paycrestV2PublicRequest("GET", "/currencies");
    if (Array.isArray(data)) {
      paycrestCurrenciesCache = { fetchedAt: Date.now(), data };
      return data;
    }
  } catch (err: any) {
    console.warn("[paycrest-v2] /currencies fetch failed:", err.message);
  }
  return paycrestCurrenciesCache?.data || [];
}

/**
 * Fetch structured v2 rate quote: GET /v2/rates/{network}/{from}/{amount}/{to}
 * Returns { buy?: { rate, providerIds, ... }, sell?: { rate, providerIds, ... } }
 */
export async function getLiveRateV2(network: string, token: string, amount: string, fiat: string) {
  const cleanAmount = Number(amount) > 0 ? String(amount) : "1";
  const upperToken = token.toUpperCase() === "CUSD" ? "USDT" : token.toUpperCase();
  const upperFiat = fiat.toUpperCase();

  try {
    const data = await paycrestV2PublicRequest(
      "GET",
      `/rates/${encodeURIComponent(network)}/${encodeURIComponent(upperToken)}/${encodeURIComponent(cleanAmount)}/${encodeURIComponent(upperFiat)}`,
    );
    if (data && (data.buy?.rate || data.sell?.rate)) {
      // If one side is missing, supplement from /v2/currencies market rate
      if (!data.buy?.rate || !data.sell?.rate) {
        const currencies = await getPaycrestCurrencies();
        const curr = currencies.find((c: any) => String(c.code).toUpperCase() === upperFiat);
        if (curr) {
          if (!data.buy?.rate && curr.marketBuyRate) {
            data.buy = { rate: String(curr.marketBuyRate), providerIds: [], orderType: "regular" };
          }
          if (!data.sell?.rate && curr.marketSellRate) {
            data.sell = { rate: String(curr.marketSellRate), providerIds: [], orderType: "regular" };
          }
        }
      }
      return data;
    }
  } catch (err: any) {
    console.warn(`[paycrest-v2-rate] Rate fetch failed for ${network}/${upperToken}/${upperFiat}:`, err.message);
  }

  // Fallback to /v2/currencies market rates
  const currencies = await getPaycrestCurrencies();
  const curr = currencies.find((c: any) => String(c.code).toUpperCase() === upperFiat);
  if (curr && (curr.marketBuyRate || curr.marketSellRate)) {
    return {
      buy: { rate: String(curr.marketBuyRate || curr.marketSellRate), providerIds: [], orderType: "regular" },
      sell: { rate: String(curr.marketSellRate || curr.marketBuyRate), providerIds: [], orderType: "regular" },
    };
  }

  const fallbackRate = DEFAULT_RATES[upperFiat];
  if (fallbackRate) {
    return {
      buy: { rate: String(fallbackRate), providerIds: [], orderType: "regular" },
      sell: { rate: String(fallbackRate), providerIds: [], orderType: "regular" },
    };
  }

  return null;
}

export async function getLiveRate(
  token: string,
  amount: string,
  currency: string,
  network: string,
  side: "sell" | "buy" = "sell",
): Promise<{ rate: string; providerIds: string[] } | null> {
  const v2 = await getLiveRateV2(network, token, amount, currency);
  const sideObj = side === "buy" ? (v2?.buy || v2?.sell) : (v2?.sell || v2?.buy);
  if (sideObj?.rate && Number(sideObj.rate) > 0) {
    return {
      rate: String(sideObj.rate),
      providerIds: Array.isArray(sideObj.providerIds) ? sideObj.providerIds : [],
    };
  }
  return null;
}

async function fetchBinanceRate(): Promise<number> {
  const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=USDTNGN", {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`binance_http_${res.status}`);
  const data: any = await res.json();
  return Number(data.price);
}

async function fetchCoinGeckoRate(): Promise<number> {
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn", {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`coingecko_http_${res.status}`);
  const data: any = await res.json();
  return Number(data.tether.ngn);
}

export async function getMarketRate(
  currency: string,
  token = "USDC",
  network = "base",
  amount = "1",
): Promise<{ rate: number; providerIds: string[] }> {
  const live = await getLiveRate(token, amount, currency, network, "sell");
  if (live && Number(live.rate) > 0) {
    return { rate: Number(live.rate), providerIds: live.providerIds };
  }

  if (currency === "NGN") {
    for (const fetcher of [fetchBinanceRate, fetchCoinGeckoRate]) {
      try {
        const rate = await fetcher();
        if (rate && rate > 0) return { rate, providerIds: [] };
      } catch (err: any) {
        console.warn(`[rate] ${fetcher.name} failed:`, err.message);
      }
    }
  }

  return { rate: DEFAULT_RATES[currency] ?? 1, providerIds: [] };
}

export async function getSupportedInstitutions(currency: string) {
  try {
    const data = await paycrestV2PublicRequest("GET", `/institutions/${encodeURIComponent(currency.toUpperCase())}`);
    const rows = Array.isArray(data) ? data : [];
    const mapped = rows
      .map((r: any) => ({
        name: String(r?.name || r?.institution || ""),
        code: String(r?.code || r?.institutionCode || ""),
        type: String(r?.type || ""),
      }))
      .filter((r) => r.name && r.code);
    if (mapped.length > 0) return mapped;
  } catch (err: any) {
    console.warn("[banks] Paycrest v2 institutions fetch failed, using fallback:", err.message);
  }

  const fallback: Record<string, Array<{ name: string; code: string; type?: string }>> = {
    NGN: [
      { name: "Access Bank", code: "ABNGNGLA", type: "bank" },
      { name: "Guaranty Trust Bank", code: "GTBINGLA", type: "bank" },
      { name: "United Bank for Africa", code: "UNAFNGLA", type: "bank" },
      { name: "Zenith Bank", code: "ZEIBNGLA", type: "bank" },
      { name: "First Bank Of Nigeria", code: "FBNINGLA", type: "bank" },
      { name: "Fidelity Bank", code: "FIDTNGLA", type: "bank" },
      { name: "FCMB", code: "FCMBNGLA", type: "bank" },
      { name: "Wema Bank", code: "WEMANGLA", type: "bank" },
      { name: "Sterling Bank", code: "NAMENGLA", type: "bank" },
      { name: "Stanbic IBTC Bank", code: "SBICNGLA", type: "bank" },
      { name: "Union Bank", code: "UBNINGLA", type: "bank" },
      { name: "Polaris Bank", code: "PRDTNGLA", type: "bank" },
      { name: "Keystone Bank", code: "PLNINGLA", type: "bank" },
      { name: "Ecobank Bank", code: "ECOCNGLA", type: "bank" },
      { name: "Providus Bank", code: "PROVNGLA", type: "bank" },
      { name: "Jaiz Bank", code: "JAIZNGLA", type: "bank" },
      { name: "OPay", code: "OPAYNGPC", type: "mobile_money" },
      { name: "Kuda Microfinance Bank", code: "KUDANGPC", type: "bank" },
      { name: "PalmPay", code: "PALMNGPC", type: "mobile_money" },
      { name: "Moniepoint MFB", code: "MONINGPC", type: "bank" },
      { name: "Safe Haven MFB", code: "SAHVNGPC", type: "bank" },
    ],
    KES: [
      { name: "M-PESA", code: "SAFAKEPC", type: "mobile_money" },
      { name: "AIRTEL", code: "AIRTKEPC", type: "mobile_money" },
      { name: "Equity Bank", code: "EQBLKENA", type: "bank" },
      { name: "Kenya Commercial Bank", code: "KCBLKENX", type: "bank" },
      { name: "Cooperative Bank of Kenya", code: "KCOOKENA", type: "bank" },
      { name: "ABSA Bank Kenya", code: "BARCKENX", type: "bank" },
      { name: "Standard Chartered Kenya", code: "SCBLKENX", type: "bank" },
      { name: "Stanbic Bank Kenya", code: "SBICKENX", type: "bank" },
      { name: "National Bank of Kenya", code: "NBKEKENX", type: "bank" },
      { name: "Family Bank", code: "FABLKENA", type: "bank" },
      { name: "Guaranty Trust Holding Company PLC", code: "GTBIKENA", type: "bank" },
    ],
    GHS: [
      { name: "MTN Mobile Money", code: "MOMOGHPC", type: "mobile_money" },
      { name: "Vodafone Cash", code: "VODAGHPC", type: "mobile_money" },
      { name: "AirtelTigo Money", code: "AIRTGHPC", type: "mobile_money" },
      { name: "GCB Bank Limited", code: "GHCBGHAC", type: "bank" },
      { name: "Ecobank Ghana", code: "ECOCGHAC", type: "bank" },
      { name: "ABSA Bank Ghana", code: "BARCGHAC", type: "bank" },
      { name: "Stanbic Bank Ghana", code: "SBICGHAC", type: "bank" },
      { name: "Access Bank Ghana", code: "ABNGGHAC", type: "bank" },
      { name: "Zenith Bank Ghana", code: "ZEBLGHAC", type: "bank" },
      { name: "GT Bank Ghana", code: "GTBIGHAC", type: "bank" },
    ],
    UGX: [
      { name: "MTN Mobile Money", code: "MOMOUGPC", type: "mobile_money" },
      { name: "Airtel Money", code: "AIRTUGPC", type: "mobile_money" },
    ],
    TZS: [
      { name: "Tigo Pesa", code: "TIGOTZPC", type: "mobile_money" },
      { name: "Airtel Money", code: "AIRTTZPC", type: "mobile_money" },
      { name: "Halopesa", code: "HALOTZPC", type: "mobile_money" },
      { name: "CRDB Bank PLC", code: "CORUTZTZ", type: "bank" },
      { name: "National Microfinance Bank Ltd.", code: "NMIBTZTZ", type: "bank" },
      { name: "Equity Bank Tanzania Limited", code: "EQBLTZTZ", type: "bank" },
      { name: "KCB Bank Tanzania Ltd", code: "KCBLTZTZ", type: "bank" },
    ],
    MWK: [
      { name: "TNM Mpamba", code: "TNMPMWPC", type: "mobile_money" },
      { name: "National Bank of Malawi", code: "NBMAMWMW", type: "bank" },
      { name: "Standard Bank Limited", code: "SBICMWMX", type: "bank" },
      { name: "FDH Bank Limited", code: "FDHFMWMW", type: "bank" },
      { name: "Ecobank Malawi Limited", code: "ECOCMWMW", type: "bank" },
    ],
    BRL: [
      { name: "Pix", code: "PIXKBRPC", type: "mobile_money" },
      { name: "PixQR", code: "PIXQBRPC", type: "mobile_money" },
    ],
  };

  return fallback[currency.toUpperCase()] || [];
}

/**
 * Verify bank or mobile account details via Paycrest v2: POST /v2/verify-account
 */
export async function verifyAccount(
  institution: string,
  accountIdentifier: string,
  metadata?: Record<string, unknown>,
) {
  const data = await paycrestV2PublicRequest("POST", "/verify-account", {
    institution,
    accountIdentifier,
    ...(metadata ? { metadata } : {}),
  });

  const resolvedStr = typeof data === "string" ? data.trim() : String(data?.accountName || data || "").trim();
  const isGenericOk = resolvedStr.toUpperCase() === "OK";

  return {
    verified: true,
    accountName: isGenericOk ? "" : resolvedStr,
    lookupSupported: !isGenericOk && resolvedStr.length > 0,
    accountNumber: accountIdentifier,
    bankCode: institution,
  };
}

export async function makeQuote(asset: string, amountCrypto: string, destinationCurrency: string) {
  const amount = Number(amountCrypto) > 0 ? Number(amountCrypto) : 0;
  const currency = (destinationCurrency || "NGN").toUpperCase();
  const paycrestAsset = ASSET_TO_PAYCREST[asset] || { token: "USDC", network: "base" };

  const { rate: sellRate, providerIds } = await getMarketRate(
    currency,
    paycrestAsset.token,
    paycrestAsset.network,
    amount > 0 ? String(amount) : "1",
  );

  // Paycrest charges senderFeePercent (2%) such that amountToTransfer = netAmount * (1 + feePct/100)
  const feeBps = Math.round(SENDER_FEE_PCT * 100);
  const netCrypto = amount / (1 + SENDER_FEE_PCT / 100);
  const receiveFiat = netCrypto * sellRate;
  const feeFiat = (amount - netCrypto) * sellRate;

  return {
    quoteId: `q_${randomUUID()}`,
    asset,
    amountCrypto: String(amountCrypto),
    destinationCurrency: currency,
    rate: String(sellRate),
    feeBps,
    feeFiat: feeFiat.toFixed(2),
    receiveFiat: receiveFiat.toFixed(2),
    providerIds,
    expiresAt: Date.now() + 5 * 60 * 1000,
    _rateInfo: {
      marketRate: sellRate.toFixed(6),
      offrampRate: sellRate.toFixed(6),
      marginPct: SENDER_FEE_PCT,
      spreadProfit: feeFiat.toFixed(2),
    },
  };
}

/**
 * Create an off-ramp order using Paycrest v2: POST /v2/sender/orders
 */
export async function createOrder(input: any) {
  const { asset, amountCrypto, recipient, returnAddress, destinationCurrency } = input;
  const currency = (destinationCurrency || "NGN").toUpperCase();
  const orderId = `ord_${randomBytes(14).toString("hex")}`;

  const quote = await makeQuote(asset, amountCrypto, currency);

  let depositAddress = "";
  let paycrestOrderId: string | undefined;
  let providerAccount: any = undefined;
  let actualRate = quote.rate;
  let actualReceiveFiat = quote.receiveFiat;
  let actualFeeFiat = quote.feeFiat;

  if (asset === "USDCX_STACKS") {
    depositAddress = process.env.DEPOSIT_WALLET_STACKS || "SP32PE6T0XA6YCV0E506J3PZNY5V6Y87A2DKNA2K5";
  } else {
    const paycrestAsset = ASSET_TO_PAYCREST[asset];
    if (!paycrestAsset) throw new Error(`Unsupported asset: ${asset}`);

    // Compute net principal so that providerAccount.amountToTransfer equals the user's amountCrypto
    const totalCrypto = Number(amountCrypto);
    if (!Number.isFinite(totalCrypto) || totalCrypto <= 0) {
      throw new Error("Invalid crypto amount");
    }
    const netAmount = Number((totalCrypto / (1 + SENDER_FEE_PCT / 100)).toFixed(4));

    const refundAddress =
      returnAddress ||
      process.env.DEPOSIT_WALLET_BASE ||
      process.env.DEPOSIT_WALLET_CELO ||
      "0xbE95bb47789E5f4Af467306C97DED0877BF817B5";

    const v2Payload: Record<string, unknown> = {
      amount: String(netAmount),
      amountIn: "crypto",
      source: {
        type: "crypto",
        currency: paycrestAsset.token,
        network: paycrestAsset.network,
        refundAddress,
      },
      destination: {
        type: "fiat",
        currency,
        recipient: {
          institution: recipient.bankCode,
          accountIdentifier: recipient.accountNumber,
          accountName: recipient.accountName,
          memo: recipient.memo || `Clova offramp ${orderId}`,
          ...(recipient.metadata ? { metadata: recipient.metadata } : {}),
        },
      },
      reference: orderId,
    };

    const pcOrder = await paycrestV2Request("POST", "/sender/orders", v2Payload);

    providerAccount = pcOrder?.providerAccount;
    depositAddress =
      pcOrder?.providerAccount?.receiveAddress ||
      pcOrder?.receiveAddress ||
      pcOrder?.depositAddress ||
      "";
    paycrestOrderId = pcOrder?.id;

    if (pcOrder?.rate) {
      actualRate = String(pcOrder.rate);
      const pcPrincipal = Number(pcOrder.amount || netAmount);
      const pcFee = Number(pcOrder.senderFee || totalCrypto - pcPrincipal);
      actualReceiveFiat = (pcPrincipal * Number(actualRate)).toFixed(2);
      actualFeeFiat = (pcFee * Number(actualRate)).toFixed(2);
    }

    if (!depositAddress) {
      throw new Error("Paycrest v2 did not return a providerAccount.receiveAddress");
    }
  }

  const validUntilMs = providerAccount?.validUntil
    ? new Date(providerAccount.validUntil).getTime()
    : Date.now() + 30 * 60 * 1000;

  const order = {
    orderId,
    direction: "offramp" as const,
    asset,
    amountCrypto: String(providerAccount?.amountToTransfer || amountCrypto),
    rate: actualRate,
    feeBps: quote.feeBps,
    feeFiat: actualFeeFiat,
    receiveFiat: actualReceiveFiat,
    destinationCurrency: currency,
    depositAddress,
    recipientName: recipient.accountName,
    recipientAccount: recipient.accountNumber,
    recipientBankCode: recipient.bankCode,
    returnAddress: returnAddress || undefined,
    paycrestOrderId,
    providerAccount,
    status: "awaiting_deposit",
    expiresAt: Number.isFinite(validUntilMs) ? validUntilMs : Date.now() + 30 * 60 * 1000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  ordersDb.set(orderId, order);
  if (paycrestOrderId) {
    ordersDb.set(paycrestOrderId, order);
  }
  recentPaycrestOrdersCache = null; // invalidate list cache
  return order;
}

function mapPaycrestStatus(pcStatus: string | undefined, direction: "onramp" | "offramp"): string {
  const s = (pcStatus || "").toLowerCase();
  if (!s) return direction === "onramp" ? "initiated" : "awaiting_deposit";

  if (s === "settled" || s === "completed" || s === "paid") return "settled";
  if (direction === "offramp" && (s === "validated" || s === "fulfilled")) return "settled";
  if (
    s === "deposited" ||
    s === "pending" ||
    s === "fulfilling" ||
    s === "fulfilled" ||
    s === "validated" ||
    s === "settling"
  ) {
    return direction === "onramp" ? "processing" : "confirming";
  }
  if (s === "initiated") {
    return direction === "onramp" ? "initiated" : "awaiting_deposit";
  }
  if (s === "refunded" || s === "refunding") return "refunded";
  if (s === "expired") return "expired";
  if (s === "cancelled" || s === "failed") return "failed";
  return s;
}

export function mapPaycrestOrderToClova(pcOrder: any, existing?: any) {
  const direction: "onramp" | "offramp" =
    pcOrder?.direction === "onramp" || pcOrder?.source?.type === "fiat" ? "onramp" : "offramp";

  const token =
    direction === "offramp"
      ? pcOrder?.source?.currency || pcOrder?.providerAccount?.currency
      : pcOrder?.destination?.currency;
  const network =
    direction === "offramp"
      ? pcOrder?.source?.network || pcOrder?.providerAccount?.network
      : pcOrder?.destination?.recipient?.network;

  const asset = existing?.asset || paycrestToAssetKey(token, network);
  const destinationCurrency = String(
    (direction === "offramp" ? pcOrder?.destination?.currency : pcOrder?.source?.currency) ||
      pcOrder?.currency ||
      existing?.destinationCurrency ||
      "NGN",
  ).toUpperCase();

  const rateNum = Number(pcOrder?.rate || existing?.rate || 0);
  const principalNum = Number(pcOrder?.amount || 0);
  const senderFeeNum = Number(pcOrder?.senderFee || 0);

  const amountCrypto =
    direction === "offramp"
      ? String(
          pcOrder?.providerAccount?.amountToTransfer ||
            pcOrder?.amountPaid ||
            pcOrder?.amountInUsd ||
            existing?.amountCrypto ||
            pcOrder?.amount ||
            "0",
        )
      : String(pcOrder?.amount || existing?.amountCrypto || "0");

  const receiveFiat =
    direction === "offramp"
      ? existing?.receiveFiat || (principalNum > 0 && rateNum > 0 ? (principalNum * rateNum).toFixed(2) : "0.00")
      : String(pcOrder?.providerAccount?.amountToTransfer || existing?.receiveFiat || "0.00");

  const feeFiat =
    existing?.feeFiat || (senderFeeNum > 0 && rateNum > 0 ? (senderFeeNum * rateNum).toFixed(2) : "0.00");

  // Extract deposit or settlement txHash from Paycrest order or transactionLogs
  let txHash = pcOrder?.txHash || existing?.txHash || undefined;
  if (!txHash && Array.isArray(pcOrder?.transactionLogs)) {
    const settledLog = pcOrder.transactionLogs.find((l: any) => l?.tx_hash && l?.status === "order_settled");
    const depositLog = pcOrder.transactionLogs.find((l: any) => l?.tx_hash && l?.status === "crypto_deposited");
    const anyLog = pcOrder.transactionLogs.find((l: any) => l?.tx_hash);
    txHash = settledLog?.tx_hash || depositLog?.tx_hash || anyLog?.tx_hash || undefined;
  }

  const createdAt = pcOrder?.createdAt
    ? new Date(pcOrder.createdAt).getTime()
    : pcOrder?.timestamp
      ? new Date(pcOrder.timestamp).getTime()
      : existing?.createdAt || Date.now();
  const updatedAt = pcOrder?.updatedAt
    ? new Date(pcOrder.updatedAt).getTime()
    : existing?.updatedAt || createdAt;
  const validUntilMs = pcOrder?.providerAccount?.validUntil
    ? new Date(pcOrder.providerAccount.validUntil).getTime()
    : existing?.expiresAt || createdAt + 30 * 60 * 1000;

  const recipientObj =
    direction === "offramp" ? pcOrder?.destination?.recipient : pcOrder?.source?.refundAccount;

  const orderId = String(pcOrder?.reference || existing?.orderId || pcOrder?.id);

  return {
    orderId,
    paycrestOrderId: String(pcOrder?.id || existing?.paycrestOrderId || ""),
    direction,
    asset,
    amountCrypto,
    rate: String(pcOrder?.rate || existing?.rate || "0"),
    feeBps: Number(pcOrder?.senderFeePercent ? Number(pcOrder.senderFeePercent) * 100 : existing?.feeBps || 200),
    feeFiat,
    receiveFiat,
    destinationCurrency,
    depositAddress: String(
      pcOrder?.providerAccount?.receiveAddress ||
        pcOrder?.providerAccount?.accountIdentifier ||
        existing?.depositAddress ||
        "",
    ),
    recipientName: String(recipientObj?.accountName || existing?.recipientName || ""),
    recipientAccount: String(recipientObj?.accountIdentifier || existing?.recipientAccount || ""),
    recipientBankCode: String(recipientObj?.institution || existing?.recipientBankCode || ""),
    returnAddress: pcOrder?.source?.refundAddress || existing?.returnAddress || undefined,
    recipientAddress: pcOrder?.destination?.recipient?.address || existing?.recipientAddress || undefined,
    providerAccount: pcOrder?.providerAccount || existing?.providerAccount || undefined,
    paymentReference: pcOrder?.paymentReference ?? existing?.paymentReference ?? null,
    status: mapPaycrestStatus(pcOrder?.status, direction),
    rawPaycrestStatus: pcOrder?.status,
    txHash,
    expiresAt: validUntilMs,
    createdAt,
    updatedAt,
  };
}

export async function fetchRecentPaycrestOrders(pageSize = 50): Promise<{ orders: any[]; total: number }> {
  if (recentPaycrestOrdersCache && Date.now() - recentPaycrestOrdersCache.fetchedAt < 10_000) {
    return { orders: recentPaycrestOrdersCache.orders, total: recentPaycrestOrdersCache.total };
  }
  try {
    const data = await paycrestV2Request("GET", `/sender/orders?page=1&pageSize=${pageSize}`);
    const rows = Array.isArray(data?.orders) ? data.orders : [];
    const total = Number(data?.total ?? rows.length);
    for (const pcOrder of rows) {
      const mapped = mapPaycrestOrderToClova(pcOrder, ordersDb.get(pcOrder.reference) || ordersDb.get(pcOrder.id));
      ordersDb.set(mapped.orderId, mapped);
      if (mapped.paycrestOrderId) {
        ordersDb.set(mapped.paycrestOrderId, mapped);
      }
    }
    recentPaycrestOrdersCache = { fetchedAt: Date.now(), orders: rows, total };
    return { orders: rows, total };
  } catch (err: any) {
    console.warn("[paycrest-v2] fetchRecentPaycrestOrders failed:", err.message);
    return { orders: recentPaycrestOrdersCache?.orders || [], total: recentPaycrestOrdersCache?.total || 0 };
  }
}

export async function getOrder(orderId: string) {
  let order = ordersDb.get(orderId);

  // If we have paycrestOrderId, poll Paycrest v2 for live status
  const pcId = order?.paycrestOrderId || (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(orderId) ? orderId : undefined);
  if (pcId) {
    try {
      const pcOrder = await paycrestV2Request("GET", `/sender/orders/${encodeURIComponent(pcId)}`);
      if (pcOrder?.id) {
        order = mapPaycrestOrderToClova(pcOrder, order);
        ordersDb.set(order.orderId, order);
        ordersDb.set(order.paycrestOrderId, order);
        return order;
      }
    } catch (err: any) {
      console.warn(`[getOrder] Live status fetch failed for ${pcId}:`, err.message);
    }
  }

  // If not in local memory cache (e.g. cold serverless instance), search recent Paycrest orders by reference
  if (!order) {
    await fetchRecentPaycrestOrders(50);
    order = ordersDb.get(orderId);
  }

  if (order) return order;

  return {
    orderId,
    status: "confirming",
    note: "Order info is being verified live via Paycrest",
  };
}

/**
 * Only return true when explicitly configured to proxy to an external backend server.
 * Since the standalone server is paused to save server costs, Next.js server-side
 * powers all services directly on Vercel.
 */
export async function checkBackendHealthy(): Promise<boolean> {
  if (process.env.CLOVA_USE_EXTERNAL_API !== "true") {
    return false;
  }
  const base = process.env.CLOVA_API_URL;
  if (!base) return false;
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Create an on-ramp order using Paycrest v2: POST /v2/sender/orders
 * Supports Paycrest's October 2026 required `source.kyc` schema.
 */
export async function createOnrampOrder(input: any) {
  const {
    amount,
    amountIn,
    sourceCurrency,
    destinationAsset,
    refundAccount,
    recipientAddress,
    kyc,
  } = input;
  const orderId = `ord_on_${randomBytes(14).toString("hex")}`;
  const currency = String(sourceCurrency || "NGN").toUpperCase();

  const paycrestAsset = ASSET_TO_PAYCREST[destinationAsset];
  if (!paycrestAsset) throw new Error("unsupported_destination_asset");

  const fullName = String(
    kyc?.personDetails?.fullName || kyc?.fullName || refundAccount?.accountName || "",
  ).trim();
  const birthDate = String(
    kyc?.personDetails?.birthDate || kyc?.birthDate || "1995-01-01",
  ).trim();

  const countryMap: Record<string, string> = {
    NGN: "NG",
    KES: "KE",
    GHS: "GH",
    UGX: "UG",
    TZS: "TZ",
    MWK: "MW",
    BRL: "BR",
    XOF: "SN",
    INR: "IN",
  };
  const issuerCountry = String(
    kyc?.personDetails?.idDocument?.issuerCountry ||
      kyc?.issuerCountry ||
      countryMap[currency] ||
      "NG",
  ).toUpperCase();

  const docType = String(
    kyc?.personDetails?.idDocument?.type ||
      kyc?.idType ||
      (currency === "NGN" ? "BVN" : "nationalID"),
  );
  const docNumber = String(
    kyc?.personDetails?.idDocument?.number || kyc?.idNumber || "",
  ).trim();

  if (!docNumber && !kyc?.entityType) {
    throw new Error(
      "Sender verification (Date of Birth and BVN/NIN/ID Number) is required by Paycrest v2 for Buy Crypto orders.",
    );
  }

  const phoneE164 = String(
    kyc?.personDetails?.contact?.phoneE164 || kyc?.phoneE164 || "",
  ).trim();

  const kycPayload = kyc?.entityType
    ? kyc
    : {
        entityType: "person",
        personDetails: {
          fullName,
          birthDate,
          ...(phoneE164 ? { contact: { phoneE164 } } : {}),
          ...(docNumber
            ? {
                idDocument: {
                  type: docType,
                  number: docNumber,
                  issuerCountry,
                },
              }
            : {}),
        },
      };

  const pcOrder = await paycrestV2Request("POST", "/sender/orders", {
    amount: String(amount),
    amountIn: amountIn || "fiat",
    source: {
      type: "fiat",
      currency,
      refundAccount: {
        institution: refundAccount.bankCode,
        accountIdentifier: refundAccount.accountNumber,
        accountName: refundAccount.accountName,
      },
      kyc: kycPayload,
    },
    destination: {
      type: "crypto",
      currency: paycrestAsset.token,
      recipient: {
        address: recipientAddress,
        network: paycrestAsset.network,
      },
    },
    reference: orderId,
  });

  const order = mapPaycrestOrderToClova(pcOrder, {
    orderId,
    direction: "onramp",
    asset: destinationAsset,
    amountCrypto: String(pcOrder?.amount || amount),
    destinationCurrency: currency,
    recipientName: refundAccount.accountName,
    recipientAccount: refundAccount.accountNumber,
    recipientBankCode: refundAccount.bankCode,
    recipientAddress,
  });

  ordersDb.set(orderId, order);
  if (order.paycrestOrderId) {
    ordersDb.set(order.paycrestOrderId, order);
  }
  recentPaycrestOrdersCache = null;
  return order;
}

export async function getOnrampOrder(orderId: string) {
  const order = await getOrder(orderId);
  if (!order || (!order.paycrestOrderId && order.note)) return null;
  return order;
}

export async function recordCreditedSettlement(input: {
  orderId?: string;
  quoteId?: string;
  asset: string;
  amountCrypto: string;
  txHash: string;
  confirmations?: number;
}) {
  const targetId = input.orderId || input.quoteId || "";
  const now = Date.now();
  const normalizedTx = input.txHash.toLowerCase();

  const existingOrder = ordersDb.get(targetId);
  if (existingOrder) {
    existingOrder.txHash = input.txHash;
    if (existingOrder.status === "awaiting_deposit" || existingOrder.status === "initiated") {
      existingOrder.status = "confirming";
    }
    existingOrder.updatedAt = now;
    ordersDb.set(targetId, existingOrder);
    if (existingOrder.paycrestOrderId) {
      ordersDb.set(existingOrder.paycrestOrderId, existingOrder);
    }
  }

  const settlement = {
    settlementId: `st_${randomUUID()}`,
    quoteId: targetId,
    asset: input.asset,
    amountCrypto: input.amountCrypto,
    txHash: normalizedTx,
    confirmations: input.confirmations || 1,
    source: "manual" as const,
    status: "credited" as const,
    createdAt: now,
    updatedAt: now,
  };

  settlementsDb.set(normalizedTx, settlement);

  return {
    settlement,
    inserted: true,
    orderId: targetId,
    paycrestOrderId: existingOrder?.paycrestOrderId,
    status: existingOrder?.status || "confirming",
    note: "EVM deposit recorded; Paycrest v2 is processing the fiat payout autonomously.",
  };
}

export async function listOrdersByAddress(address: string, limit = 50) {
  const needle = address.trim().toLowerCase();
  if (!needle) return [];

  await fetchRecentPaycrestOrders(100);

  const uniqueByRef = new Map<string, any>();
  for (const o of ordersDb.values()) {
    if (!o?.orderId) continue;
    const matchReturn = o.returnAddress?.toLowerCase() === needle;
    const matchRecipient = o.recipientAddress?.toLowerCase() === needle;
    if (matchReturn || matchRecipient) {
      uniqueByRef.set(o.orderId, o);
    }
  }

  return Array.from(uniqueByRef.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit)
    .map((o) => ({
      orderId: o.orderId,
      direction: o.direction || "offramp",
      asset: o.asset,
      amountCrypto: o.amountCrypto,
      destinationCurrency: o.destinationCurrency || "NGN",
      receiveFiat: o.receiveFiat,
      status: o.status,
      paymentReference: o.paymentReference || null,
      txHash: o.txHash || null,
      txExplorerUrl: o.txHash ? explorerTxUrl(o.asset, o.txHash) : null,
      createdAt: o.createdAt,
    }));
}

export async function getNetworkStats() {
  const [{ orders: pcOrders, total: pcTotal }, senderStats] = await Promise.all([
    fetchRecentPaycrestOrders(100),
    paycrestV2Request("GET", "/sender/stats").catch(() => null),
  ]);

  const uniqueOrders = new Map<string, any>();
  for (const o of ordersDb.values()) {
    if (o?.orderId) uniqueOrders.set(o.orderId, o);
  }
  const allOrders = Array.from(uniqueOrders.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const totals = {
    orders: Math.max(Number(senderStats?.totalOrders || 0), pcTotal, allOrders.length),
    settlements: 0,
    payouts: 0,
    byStatus: {
      awaiting_deposit: 0,
      confirming: 0,
      paid_out: 0,
      settled: 0,
      failed: 0,
      expired: 0,
    } as Record<string, number>,
    byAsset: {} as Record<string, number>,
    volume: {
      crypto: {} as Record<string, number>,
      fiat: 0,
      fiatByCurrency: {} as Record<string, number>,
    },
  };

  const txRecords: Array<{
    asset: string;
    txHash: string;
    explorerUrl: string;
    quoteId: string;
    amountCrypto: string;
    createdAt: number;
  }> = [];
  const seenTxs = new Set<string>();

  for (const o of allOrders) {
    const st = o.status || "awaiting_deposit";
    totals.byStatus[st] = (totals.byStatus[st] || 0) + 1;
    if (st === "settled" || st === "paid_out") {
      totals.payouts += 1;
    }

    const asset = o.asset || "USDC_BASE";
    totals.byAsset[asset] = (totals.byAsset[asset] || 0) + 1;

    const amt = Number(o.amountCrypto || 0);
    if (Number.isFinite(amt) && amt > 0) {
      totals.volume.crypto[asset] = (totals.volume.crypto[asset] || 0) + amt;
    }

    const fiat = Number(o.receiveFiat || 0);
    const currency = o.destinationCurrency || "NGN";
    if (Number.isFinite(fiat) && fiat > 0 && st === "settled") {
      totals.volume.fiat += fiat;
      totals.volume.fiatByCurrency[currency] = (totals.volume.fiatByCurrency[currency] || 0) + fiat;
    }

    if (o.txHash && !seenTxs.has(o.txHash.toLowerCase())) {
      seenTxs.add(o.txHash.toLowerCase());
      txRecords.push({
        asset,
        txHash: o.txHash,
        explorerUrl: explorerTxUrl(asset, o.txHash),
        quoteId: o.orderId,
        amountCrypto: o.amountCrypto,
        createdAt: o.updatedAt || o.createdAt,
      });
    }
  }

  for (const s of settlementsDb.values()) {
    if (s.txHash && !seenTxs.has(s.txHash.toLowerCase())) {
      seenTxs.add(s.txHash.toLowerCase());
      txRecords.push({
        asset: s.asset,
        txHash: s.txHash,
        explorerUrl: explorerTxUrl(s.asset, s.txHash),
        quoteId: s.quoteId,
        amountCrypto: s.amountCrypto,
        createdAt: s.createdAt,
      });
    }
  }

  totals.settlements = Math.max(txRecords.length, totals.payouts);

  const DAY_MS = 24 * 60 * 60 * 1000;
  const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  const series: { date: string; orders: number; x402Calls: number }[] = [];
  const seriesIndex = new Map<string, { date: string; orders: number; x402Calls: number }>();

  for (let i = 29; i >= 0; i--) {
    const d = dayKey(Date.now() - i * DAY_MS);
    const row = { date: d, orders: 0, x402Calls: 0 };
    series.push(row);
    seriesIndex.set(d, row);
  }
  for (const o of allOrders) {
    if (o.createdAt) {
      const row = seriesIndex.get(dayKey(o.createdAt));
      if (row) row.orders += 1;
    }
  }

  return {
    ok: true,
    generatedAt: Date.now(),
    totals,
    x402: {
      totalCalls: 0,
      calls30d: 0,
      distinctPayers: 0,
      distinctPayers30d: 0,
      byEndpoint: {},
      lastEvents: [],
    },
    series,
    lastTxs: txRecords.sort((a, b) => b.createdAt - a.createdAt).slice(0, 25),
    lastOrders: allOrders.slice(0, 20).map((o) => ({
      orderId: o.orderId,
      asset: o.asset,
      amountCrypto: o.amountCrypto,
      destinationCurrency: o.destinationCurrency || "NGN",
      status: o.status,
      txHash: o.txHash || null,
      txExplorerUrl: o.txHash ? explorerTxUrl(o.asset, o.txHash) : null,
      createdAt: o.createdAt,
    })),
  };
}

export function verifyPaycrestWebhookSignature(rawBody: string, signature?: string | null): boolean {
  const secret = (process.env.PAYCREST_WEBHOOK_SECRET || process.env.PAYCREST_API_KEY || "").trim();
  const sig = (signature || "").trim().toLowerCase();
  if (!secret || !sig) return false;

  try {
    const computed = createHmac("sha256", secret)
      .update(Buffer.from(rawBody, "utf8"))
      .digest("hex")
      .toLowerCase();
    if (computed.length !== sig.length) return false;
    return timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(sig, "utf8"));
  } catch {
    return false;
  }
}

export async function handlePaycrestWebhook(payload: any) {
  const eventName = String(payload?.event || "");
  const data = payload?.data || payload;
  const reference = String(data?.reference || data?.orderId || data?.id || "");
  if (!reference) return { ok: true, ignored: true };

  const existing = ordersDb.get(reference) || (data?.id ? ordersDb.get(String(data.id)) : undefined);
  const mapped = mapPaycrestOrderToClova(data, existing);

  // Branch on v2 event names (payment_order.*) and legacy v1 event names (order.*)
  if (
    eventName === "payment_order.settled" ||
    eventName === "payment_order.validated" ||
    eventName === "order.fulfilled" ||
    eventName === "order.settled"
  ) {
    mapped.status = "settled";
  } else if (
    eventName === "payment_order.deposited" ||
    eventName === "payment_order.pending" ||
    eventName === "payment_order.settling"
  ) {
    mapped.status = mapped.direction === "onramp" ? "processing" : "confirming";
  } else if (eventName === "payment_order.refunded" || eventName === "payment_order.refunding") {
    mapped.status = "refunded";
  } else if (eventName === "payment_order.expired" || eventName === "order.expired") {
    mapped.status = "expired";
  } else if (eventName === "order.failed" || eventName === "payment_order.failed") {
    mapped.status = "failed";
  }

  ordersDb.set(mapped.orderId, mapped);
  if (mapped.paycrestOrderId) {
    ordersDb.set(mapped.paycrestOrderId, mapped);
  }
  recentPaycrestOrdersCache = null;

  return { ok: true, orderId: mapped.orderId, status: mapped.status, event: eventName };
}
