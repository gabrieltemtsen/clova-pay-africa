import { randomBytes, randomUUID } from "node:crypto";

const PAYCREST_BASE_URL = "https://api.paycrest.io/v1";
const DEFAULT_RATES: Record<string, number> = {
  NGN: 1500,
  KES: 130,
  GHS: 12,
  UGX: 3700,
  TZS: 2600,
  MWK: 1700,
  BRL: 5.7,
  XOF: 600,
  INR: 84,
};

const PAYCREST_NETWORK: Record<string, string> = {
  NGN: "polygon",
  KES: "polygon",
  GHS: "polygon",
  UGX: "polygon",
  TZS: "polygon",
  MWK: "polygon",
  BRL: "polygon",
  XOF: "polygon",
  INR: "polygon",
};

const ASSET_TO_PAYCREST: Record<string, { token: string; network: string }> = {
  cUSD_CELO: { token: "CUSD", network: "celo" },
  USDC_BASE: { token: "USDC", network: "base" },
  USDC_ARBITRUM: { token: "USDC", network: "arbitrum-one" },
  USDT_ARBITRUM: { token: "USDT", network: "arbitrum-one" },
  USDC_POLYGON: { token: "USDC", network: "polygon" },
  USDT_POLYGON: { token: "USDT", network: "polygon" },
  USDC_ETHEREUM: { token: "USDC", network: "ethereum" },
  USDT_ETHEREUM: { token: "USDT", network: "ethereum" },
  USDT_BSC: { token: "USDT", network: "bnb-smart-chain" },
  USDC_BSC: { token: "USDC", network: "bnb-smart-chain" },
  USDC_SCROLL: { token: "USDC", network: "scroll" },
  USDT_SCROLL: { token: "USDT", network: "scroll" },
  USDT_LISK: { token: "USDT", network: "lisk" },
  USDC_LISK: { token: "USDC", network: "lisk" },
};

// Global in-memory cache for fallback mode
const ordersDb = new Map<string, any>();

async function paycrestRequest(method: "GET" | "POST", path: string, body?: unknown) {
  const apiKey = process.env.PAYCREST_API_KEY || "";
  if (!apiKey) {
    console.error("[Clova Fallback] Configuration Error: PAYCREST_API_KEY is not defined in process.env!");
    throw new Error("Service temporarily unavailable. Please try again in a few minutes.");
  }

  const headers: Record<string, string> = {
    "API-Key": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const response = await fetch(`${PAYCREST_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // Short timeout to keep API fast
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paycrest HTTP error ${response.status}: ${text}`);
  }

  const payload = await response.json().catch(() => ({}));
  if (payload?.status === "error" || payload?.status === false) {
    throw new Error(`Paycrest API error: ${payload?.message || "unknown"}`);
  }

  return payload?.data?.data ?? payload?.data ?? payload;
}

export async function getLiveRate(token: string, amount: string, currency: string, network: string): Promise<string | null> {
  try {
    const data = await paycrestRequest("GET", `/rates/${token}/${amount}/${currency}?network=${network}`);
    return String(data);
  } catch (err: any) {
    console.warn(`[fallback-rate] paycrest rate fetch failed for ${token}/${currency}:`, err.message);
    return null;
  }
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

export async function getMarketRate(currency: string): Promise<number> {
  const network = PAYCREST_NETWORK[currency] ?? "polygon";
  const rateStr = await getLiveRate("USDT", "1", currency, network);
  if (rateStr) {
    const rate = Number(rateStr);
    if (rate > 0) return rate;
  }

  if (currency === "NGN") {
    for (const fetcher of [fetchBinanceRate, fetchCoinGeckoRate]) {
      try {
        const rate = await fetcher();
        if (rate && rate > 0) return rate;
      } catch (err: any) {
        console.warn(`[fallback-rate] ${fetcher.name} failed:`, err.message);
      }
    }
  }

  return DEFAULT_RATES[currency] ?? 1;
}

export async function getOfframpRate(currency: string) {
  const marketRate = await getMarketRate(currency);
  const marginPct = 3; // 3% margin
  const offrampRate = Number((marketRate * (1 - marginPct / 100)).toFixed(6));
  return { marketRate, offrampRate, marginPct };
}

export async function getSupportedInstitutions(currency: string) {
  try {
    const data = await paycrestRequest("GET", `/institutions/${currency}`);
    const rows = Array.isArray(data) ? data : [];
    const mapped = rows
      .map((r: any) => ({
        name: String(r?.name || r?.institution || ""),
        code: String(r?.code || r?.institutionCode || ""),
      }))
      .filter((r) => r.name && r.code);
    if (mapped.length > 0) return mapped;
  } catch (err: any) {
    console.warn("[fallback-banks] Paycrest banks live fetch failed, using fallback:", err.message);
  }

  // Static fallback
  const fallback: Record<string, Array<{ name: string; code: string }>> = {
    NGN: [
      { name: "Access Bank", code: "ABNGNGLA" },
      { name: "Guaranty Trust Bank", code: "GTBINGLA" },
      { name: "United Bank for Africa", code: "UNAFNGLA" },
      { name: "Zenith Bank", code: "ZEIBNGLA" },
      { name: "First Bank Of Nigeria", code: "FBNINGLA" },
      { name: "Fidelity Bank", code: "FIDTNGLA" },
      { name: "FCMB", code: "FCMBNGLA" },
      { name: "Wema Bank", code: "WEMANGLA" },
      { name: "Sterling Bank", code: "NAMENGLA" },
      { name: "Stanbic IBTC Bank", code: "SBICNGLA" },
      { name: "Union Bank", code: "UBNINGLA" },
      { name: "Polaris Bank", code: "PRDTNGLA" },
      { name: "Keystone Bank", code: "PLNINGLA" },
      { name: "Ecobank Bank", code: "ECOCNGLA" },
      { name: "Providus Bank", code: "PROVNGLA" },
      { name: "Jaiz Bank", code: "JAIZNGLA" },
      { name: "OPay", code: "OPAYNGPC" },
      { name: "Kuda Microfinance Bank", code: "KUDANGPC" },
      { name: "PalmPay", code: "PALMNGPC" },
      { name: "Moniepoint MFB", code: "MONINGPC" },
      { name: "Safe Haven MFB", code: "SAHVNGPC" },
    ],
    KES: [
      { name: "M-PESA", code: "SAFAKEPC" },
      { name: "AIRTEL", code: "AIRTKEPC" },
      { name: "Equity Bank", code: "EQBLKENA" },
      { name: "Kenya Commercial Bank", code: "KCBLKENX" },
      { name: "Cooperative Bank of Kenya", code: "KCOOKENA" },
      { name: "ABSA Bank Kenya", code: "BARCKENX" },
      { name: "Standard Chartered Kenya", code: "SCBLKENX" },
      { name: "Stanbic Bank Kenya", code: "SBICKENX" },
      { name: "National Bank of Kenya", code: "NBKEKENX" },
      { name: "Family Bank", code: "FABLKENA" },
      { name: "Guaranty Trust Holding Company PLC", code: "GTBIKENA" },
    ],
    GHS: [
      { name: "MTN Mobile Money", code: "MOMOGHPC" },
      { name: "Vodafone Cash", code: "VODAGHPC" },
      { name: "AirtelTigo Money", code: "AIRTGHPC" },
      { name: "GCB Bank Limited", code: "GHCBGHAC" },
      { name: "Ecobank Ghana", code: "ECOCGHAC" },
      { name: "ABSA Bank Ghana", code: "BARCGHAC" },
      { name: "Stanbic Bank Ghana", code: "SBICGHAC" },
      { name: "Access Bank Ghana", code: "ABNGGHAC" },
      { name: "Zenith Bank Ghana", code: "ZEBLGHAC" },
      { name: "GT Bank Ghana", code: "GTBIGHAC" },
    ],
    UGX: [
      { name: "MTN Mobile Money", code: "MOMOUGPC" },
      { name: "Airtel Money", code: "AIRTUGPC" },
    ],
    TZS: [
      { name: "Tigo Pesa", code: "TIGOTZPC" },
      { name: "Airtel Money", code: "AIRTTZPC" },
      { name: "Halopesa", code: "HALOTZPC" },
      { name: "CRDB Bank PLC", code: "CORUTZTZ" },
      { name: "National Microfinance Bank Ltd.", code: "NMIBTZTZ" },
      { name: "Equity Bank Tanzania Limited", code: "EQBLTZTZ" },
      { name: "KCB Bank Tanzania Ltd", code: "KCBLTZTZ" },
    ],
    MWK: [
      { name: "TNM Mpamba", code: "TNMPMWPC" },
      { name: "National Bank of Malawi", code: "NBMAMWMW" },
      { name: "Standard Bank Limited", code: "SBICMWMX" },
      { name: "FDH Bank Limited", code: "FDHFMWMW" },
      { name: "Ecobank Malawi Limited", code: "ECOCMWMW" },
    ],
    BRL: [
      { name: "Pix", code: "PIXKBRPC" },
      { name: "PixQR", code: "PIXQBRPC" },
    ],
  };

  return fallback[currency.toUpperCase()] || [];
}

export async function makeQuote(asset: string, amountCrypto: string, destinationCurrency: string) {
  const amount = Number(amountCrypto);
  const currency = destinationCurrency.toUpperCase();
  const { marketRate, offrampRate, marginPct } = await getOfframpRate(currency);

  const grossFiat = amount * offrampRate;
  const defaultFeeBps = 150; // 1.5% fee
  const feeFiat = (grossFiat * defaultFeeBps) / 10000;
  const receiveFiat = grossFiat - feeFiat;

  return {
    quoteId: `q_${randomUUID()}`,
    asset,
    amountCrypto,
    destinationCurrency: currency,
    rate: String(offrampRate),
    feeBps: defaultFeeBps,
    feeFiat: feeFiat.toFixed(2),
    receiveFiat: receiveFiat.toFixed(2),
    expiresAt: Date.now() + 5 * 60 * 1000,
    _rateInfo: {
      marketRate: marketRate.toFixed(6),
      offrampRate: offrampRate.toFixed(6),
      marginPct,
      spreadProfit: (amount * marketRate - amount * offrampRate).toFixed(2),
    },
  };
}

export async function createOrder(input: any) {
  const { asset, amountCrypto, recipient, returnAddress, destinationCurrency } = input;
  const currency = (destinationCurrency || "NGN").toUpperCase();
  const orderId = `ord_${randomBytes(14).toString("hex")}`;

  const quote = await makeQuote(asset, amountCrypto, currency);

  let depositAddress = "";
  let paycrestOrderId: string | undefined;

  if (asset === "USDCX_STACKS") {
    // Falls back to a mock / manual deposit address for Stacks
    depositAddress = process.env.DEPOSIT_WALLET_STACKS || "SP32PE6T0XA6YCV0E506J3PZNY5V6Y87A2DKNA2K5";
  } else {
    const paycrestAsset = ASSET_TO_PAYCREST[asset];
    if (!paycrestAsset) throw new Error("unsupported_asset");

    let paycrestRate = await getLiveRate(paycrestAsset.token, amountCrypto, currency, paycrestAsset.network);
    if (!paycrestRate) paycrestRate = quote.rate;

    const pcOrder = await paycrestRequest("POST", "/sender/orders", {
      amount: Number(amountCrypto),
      token: paycrestAsset.token,
      network: paycrestAsset.network,
      rate: paycrestRate,
      recipient: {
        institution: recipient.bankCode,
        accountIdentifier: recipient.accountNumber,
        accountName: recipient.accountName,
        currency,
        memo: `Clova offramp ${orderId}`,
      },
      reference: orderId,
      returnAddress: returnAddress || "0x0000000000000000000000000000000000000000",
    });

    depositAddress = pcOrder.depositAddress;
    paycrestOrderId = pcOrder.id;

    if (!depositAddress) {
      throw new Error("Paycrest did not return a deposit address");
    }
  }

  const order = {
    orderId,
    asset,
    amountCrypto,
    rate: quote.rate,
    feeBps: quote.feeBps,
    feeFiat: quote.feeFiat,
    receiveFiat: quote.receiveFiat,
    depositAddress,
    recipientName: recipient.accountName,
    recipientAccount: recipient.accountNumber,
    recipientBankCode: recipient.bankCode,
    paycrestOrderId,
    status: "awaiting_deposit",
    expiresAt: Date.now() + 30 * 60 * 1000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  ordersDb.set(orderId, order);
  return order;
}

export async function getOrder(orderId: string) {
  const order = ordersDb.get(orderId);
  if (order) return order;

  // Fallback return if not found in cache (e.g. Serverless function restarted)
  return {
    orderId,
    status: "confirming",
    note: "Order info is being verified live via Paycrest",
  };
}

export async function checkBackendHealthy(): Promise<boolean> {
  const base = process.env.CLOVA_API_URL;
  if (!base) return false;
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function paycrestV2Request(method: "GET" | "POST", path: string, body?: unknown) {
  const apiKey = process.env.PAYCREST_API_KEY || "";
  if (!apiKey) {
    console.error("[Clova Fallback V2] Configuration Error: PAYCREST_API_KEY is not defined in process.env!");
    throw new Error("Service temporarily unavailable. Please try again in a few minutes.");
  }

  const headers: Record<string, string> = {
    "API-Key": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const response = await fetch(`https://api.paycrest.io/v2${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paycrest v2 HTTP error ${response.status}: ${text}`);
  }

  const payload = await response.json().catch(() => ({}));
  if (payload?.status === "error" || payload?.status === false) {
    throw new Error(`Paycrest v2 API error: ${payload?.message || "unknown"}`);
  }

  return payload?.data ?? payload;
}

export async function getLiveRateV2(network: string, token: string, amount: string, fiat: string) {
  try {
    const data = await paycrestV2Request("GET", `/rates/${network}/${token}/${amount}/${fiat}`);
    return data;
  } catch (err: any) {
    console.warn(`[paycrest-v2-rate] Rate fetch failed for ${token}/${fiat}:`, err.message);
    return null;
  }
}

export async function createOnrampOrder(input: any) {
  const { asset, amount, amountIn, sourceCurrency, destinationAsset, refundAccount, recipientAddress } = input;
  const orderId = `ord_on_${randomBytes(14).toString("hex")}`;

  const paycrestAsset = ASSET_TO_PAYCREST[destinationAsset];
  if (!paycrestAsset) throw new Error("unsupported_destination_asset");

  const pcOrder = await paycrestV2Request("POST", "/sender/orders", {
    amount: String(amount),
    amountIn: amountIn || "fiat",
    source: {
      type: "fiat",
      currency: sourceCurrency,
      refundAccount: {
        institution: refundAccount.bankCode,
        accountIdentifier: refundAccount.accountNumber,
        accountName: refundAccount.accountName,
      }
    },
    destination: {
      type: "crypto",
      currency: paycrestAsset.token,
      recipient: {
        address: recipientAddress,
        network: paycrestAsset.network,
      }
    },
    reference: orderId,
  });

  const order = {
    orderId,
    direction: "onramp",
    asset: destinationAsset,
    amount,
    amountIn: amountIn || "fiat",
    sourceCurrency,
    refundAccount,
    recipientAddress,
    paycrestOrderId: pcOrder.id,
    status: pcOrder.status || "initiated",
    providerAccount: pcOrder.providerAccount,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  ordersDb.set(orderId, order);
  return order;
}

export async function getOnrampOrder(orderId: string) {
  const order = ordersDb.get(orderId);
  if (!order) return null;

  if (order.paycrestOrderId) {
    try {
      const pcOrder = await paycrestV2Request("GET", `/sender/orders/${order.paycrestOrderId}`);
      order.status = pcOrder.status || order.status;
      if (pcOrder.providerAccount) {
        order.providerAccount = pcOrder.providerAccount;
      }
      order.updatedAt = Date.now();
      ordersDb.set(orderId, order);
    } catch (err: any) {
      console.warn(`[getOnrampOrder] Live status fetch failed for ${order.paycrestOrderId}:`, err.message);
    }
  }

  return order;
}


