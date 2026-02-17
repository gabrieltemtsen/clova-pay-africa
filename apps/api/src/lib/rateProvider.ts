import { config } from "./config.js";

type RateCache = {
    rate: number;
    fetchedAt: number;
};

let cache: RateCache | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Fetch live USDT/NGN P2P-equivalent rate from multiple sources.
 * Falls back to the static DEFAULT_NGN_RATE if all sources fail.
 */
async function fetchLiveRate(): Promise<number> {
    const sources = [
        fetchBinanceRate,
        fetchCoinGeckoRate,
    ];

    for (const fetcher of sources) {
        try {
            const rate = await fetcher();
            if (rate && rate > 0) {
                console.log(`[rate] fetched live rate: ₦${rate.toFixed(2)}/USD from ${fetcher.name}`);
                return rate;
            }
        } catch (err: any) {
            console.warn(`[rate] ${fetcher.name} failed: ${err.message}`);
        }
    }

    console.warn(`[rate] all sources failed, using fallback: ₦${config.defaultNgnRate}`);
    return config.defaultNgnRate;
}

/**
 * Binance P2P-style rate via spot USDT/NGN.
 * Uses the Binance public ticker API.
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
 * Get the current NGN rate with caching.
 * Returns the market rate BEFORE applying the company margin.
 */
export async function getMarketRate(): Promise<number> {
    if (cache && (Date.now() - cache.fetchedAt) < CACHE_TTL_MS) {
        return cache.rate;
    }

    const rate = await fetchLiveRate();
    cache = { rate, fetchedAt: Date.now() };
    return rate;
}

/**
 * Get the rate offered to users (market rate minus company margin).
 * This is what users actually receive per USD.
 *
 * Example: market = ₦1,580, margin = 3% → user gets ₦1,531.40
 */
export async function getOfframpRate(): Promise<{ marketRate: number; offrampRate: number; marginPct: number }> {
    const marketRate = await getMarketRate();
    const marginPct = config.rateMarginPct;
    const offrampRate = Math.round(marketRate * (1 - marginPct / 100));

    return { marketRate, offrampRate, marginPct };
}

/**
 * Force refresh the cached rate (useful after config changes).
 */
export function invalidateRateCache() {
    cache = null;
}
