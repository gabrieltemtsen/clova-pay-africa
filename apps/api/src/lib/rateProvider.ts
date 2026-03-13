import { config } from "./config.js";
import { PaycrestProvider } from "../providers/paycrest.js";
import type { SupportedCurrency } from "./types.js";

type RateCache = {
    rate: number;
    fetchedAt: number;
};

const cacheMap = new Map<string, RateCache>();
const CACHE_TTL_MS = 60_000; // 1 minute

const paycrest = new PaycrestProvider();

// Network to use for Paycrest rate lookups
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

/**
 * Fetch live USDT/<currency> rate for any supported currency.
 * Primary source: Paycrest rate API. Falls back to static defaultRates.
 */
async function fetchLiveRate(currency: SupportedCurrency): Promise<number> {
    try {
        const network = PAYCREST_NETWORK[currency] ?? "polygon";
        const rateStr = await paycrest.getLiveRate("USDT", "1", currency, network);
        if (rateStr) {
            const rate = Number(rateStr);
            if (rate > 0) {
                console.log(`[rate] paycrest live rate: ${rate.toFixed(4)} ${currency}/USD`);
                return rate;
            }
        }
    } catch (err: any) {
        console.warn(`[rate] paycrest rate fetch failed for ${currency}: ${err.message}`);
    }

    // Fallback to Binance/CoinGecko for NGN only (legacy)
    if (currency === "NGN") {
        for (const fetcher of [fetchBinanceRate, fetchCoinGeckoRate]) {
            try {
                const rate = await fetcher();
                if (rate && rate > 0) {
                    console.log(`[rate] fallback live rate (${fetcher.name}): ₦${rate.toFixed(2)}/USD`);
                    return rate;
                }
            } catch (err: any) {
                console.warn(`[rate] ${fetcher.name} failed: ${err.message}`);
            }
        }
    }

    const fallback = config.defaultRates[currency] ?? 1;
    console.warn(`[rate] all sources failed for ${currency}, using fallback: ${fallback}`);
    return fallback;
}

/**
 * Binance P2P-style rate via spot USDT/NGN.
 */
async function fetchBinanceRate(): Promise<number> {
    const res = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbol=USDTNGN",
        { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`binance_http_${res.status}`);
    const data: any = await res.json();
    return Number(data.price);
}

/**
 * CoinGecko free API: get NGN price of tether.
 */
async function fetchCoinGeckoRate(): Promise<number> {
    const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn",
        { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`coingecko_http_${res.status}`);
    const data: any = await res.json();
    return Number(data.tether.ngn);
}

/**
 * Get the current rate for a currency with caching.
 * Returns the market rate BEFORE applying the company margin.
 */
export async function getMarketRate(currency: SupportedCurrency = "NGN"): Promise<number> {
    const cached = cacheMap.get(currency);
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
        return cached.rate;
    }

    const rate = await fetchLiveRate(currency);
    cacheMap.set(currency, { rate, fetchedAt: Date.now() });
    return rate;
}

/**
 * Get the rate offered to users (market rate minus company margin).
 * This is what users actually receive per USD.
 */
export async function getOfframpRate(currency: SupportedCurrency = "NGN"): Promise<{ marketRate: number; offrampRate: number; marginPct: number }> {
    const marketRate = await getMarketRate(currency);
    const marginPct = config.rateMarginPct;
    const offrampRate = Number((marketRate * (1 - marginPct / 100)).toFixed(6));

    return { marketRate, offrampRate, marginPct };
}

/**
 * Force refresh the cached rate for a currency (or all currencies).
 */
export function invalidateRateCache(currency?: SupportedCurrency) {
    if (currency) {
        cacheMap.delete(currency);
    } else {
        cacheMap.clear();
    }
}
