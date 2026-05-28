"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, ChevronDown, Copy, Loader2, Wallet, Sparkles,
  ArrowDownUp, Shield, Zap, AlertTriangle, ExternalLink, Fuel,
  TrendingUp, ArrowLeft, Clock
} from "lucide-react";
import type { AssetKey, CreateOrderInput, Institution, Order } from "@/lib/clova";
import { cn } from "@/lib/utils";
import { erc20Abi, parseUnits, formatUnits } from "viem";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContract, usePublicClient, useBalance } from "wagmi";
import { base, celo, arbitrum, polygon, mainnet, bsc, scroll, lisk } from "viem/chains";

/* ────────────────────────────────── Constants ────────────────────────────────── */

const CORRIDORS = ["NGN", "KES", "GHS", "UGX", "TZS", "MWK", "BRL", "XOF", "INR"] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦", KES: "KSh", GHS: "₵", UGX: "USh", TZS: "TSh",
  MWK: "MK", BRL: "R$", XOF: "CFA", INR: "₹",
};

const CHAIN_INFO: Record<number, { name: string; icon: string; color: string; nativeSymbol: string }> = {
  [celo.id]:     { name: "Celo",       icon: "🟡", color: "#FCFF52", nativeSymbol: "CELO" },
  [base.id]:     { name: "Base",       icon: "🔵", color: "#0052FF", nativeSymbol: "ETH" },
  [arbitrum.id]: { name: "Arbitrum",   icon: "🔷", color: "#28A0F0", nativeSymbol: "ETH" },
  [polygon.id]:  { name: "Polygon",    icon: "🟣", color: "#8247E5", nativeSymbol: "POL" },
  [mainnet.id]:  { name: "Ethereum",   icon: "⟠",  color: "#627EEA", nativeSymbol: "ETH" },
  [bsc.id]:      { name: "BNB Chain",  icon: "🟡", color: "#F0B90B", nativeSymbol: "BNB" },
  [scroll.id]:   { name: "Scroll",     icon: "📜", color: "#FFDBB0", nativeSymbol: "ETH" },
  [lisk.id]:     { name: "Lisk",       icon: "🔶", color: "#0D4EA6", nativeSymbol: "ETH" },
};

const NETWORK_MAP: Record<number, string> = {
  [celo.id]: "celo",
  [base.id]: "base",
  [arbitrum.id]: "arbitrum-one",
  [polygon.id]: "polygon",
  [mainnet.id]: "ethereum",
  [bsc.id]: "bnb-smart-chain",
  [scroll.id]: "scroll",
  [lisk.id]: "lisk",
};

const ASSETS: Array<{
  key: AssetKey; label: string; chainLabel: string;
  kind: "evm" | "stacks"; decimals: number;
  tokenAddress?: `0x${string}`; chainId?: number;
}> = [
  { key: "cUSD_CELO", label: "cUSD", chainLabel: "Celo", kind: "evm", decimals: 18, tokenAddress: "0x765DE816845861e75A25fCA122bb6898B8B1282a", chainId: celo.id },
  { key: "USDC_BASE", label: "USDC", chainLabel: "Base", kind: "evm", decimals: 6, tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chainId: base.id },
  { key: "USDC_ARBITRUM", label: "USDC", chainLabel: "Arbitrum One", kind: "evm", decimals: 6, tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", chainId: arbitrum.id },
  { key: "USDT_ARBITRUM", label: "USDT", chainLabel: "Arbitrum One", kind: "evm", decimals: 6, tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", chainId: arbitrum.id },
  { key: "USDC_POLYGON", label: "USDC", chainLabel: "Polygon", kind: "evm", decimals: 6, tokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", chainId: polygon.id },
  { key: "USDT_POLYGON", label: "USDT", chainLabel: "Polygon", kind: "evm", decimals: 6, tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", chainId: polygon.id },
  { key: "USDC_ETHEREUM", label: "USDC", chainLabel: "Ethereum", kind: "evm", decimals: 6, tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainId: mainnet.id },
  { key: "USDT_ETHEREUM", label: "USDT", chainLabel: "Ethereum", kind: "evm", decimals: 6, tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", chainId: mainnet.id },
  { key: "USDT_BSC", label: "USDT", chainLabel: "BNB Smart Chain", kind: "evm", decimals: 18, tokenAddress: "0x55d398326f99059fF775485246999027B3197955", chainId: bsc.id },
  { key: "USDC_BSC", label: "USDC", chainLabel: "BNB Smart Chain", kind: "evm", decimals: 18, tokenAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32CD580d", chainId: bsc.id },
  { key: "USDC_SCROLL", label: "USDC", chainLabel: "Scroll", kind: "evm", decimals: 6, tokenAddress: "0x06eFDBff2a14a7c8E15994D0F3738598cf459980", chainId: scroll.id },
  { key: "USDT_SCROLL", label: "USDT", chainLabel: "Scroll", kind: "evm", decimals: 6, tokenAddress: "0xf55BEC9dbDb332568D1141DaAE05654C84b768a3", chainId: scroll.id },
  { key: "USDT_LISK", label: "USDT", chainLabel: "Lisk", kind: "evm", decimals: 6, tokenAddress: "0x05D034367b937613502b414609acEf12D1f84d68", chainId: lisk.id },
  // { key: "USDCX_STACKS", label: "USDCx", chainLabel: "Stacks", kind: "stacks", decimals: 6 },
];

/* ────────────────────────────────── Helpers ────────────────────────────────── */

function shorten(s: string, head = 6, tail = 4) {
  if (!s) return s;
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function money(n: string | number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function moneyPrecise(n: string | number, digits = 6) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 2 });
}

/* ────────────────────────────────── Types ────────────────────────────────── */

type FlowState =
  | { kind: "editing" }
  | { kind: "creating_order" }
  | { kind: "awaiting_wallet"; order: Order }
  | { kind: "deposit_sent"; order: Order; txHash?: string }
  | { kind: "confirming"; order: Order; txHash: string }
  | { kind: "done"; order: Order; txHash?: string }
  | { kind: "error"; message: string };

export const dynamic = "force-dynamic";

async function loadStacks() {
  return await import("@/lib/stacks");
}

function formatErrorMessage(msg: string): string {
  if (!msg) return "An unexpected error occurred. Please try again.";

  // Account / bank verification failure
  if (msg.includes("Account validation failed") || msg.includes("failed to verify account")) {
    return "Bank account verification failed. Please check that the account number and selected bank are correct.";
  }

  // Paycrest order failure proxy
  if (msg.includes("paycrest_order_failed") || msg.includes("http_400") || msg.includes("Bad Request")) {
    // Check if it's the account verification issue inside the payload
    if (msg.includes("failed to verify account with any provider")) {
      return "Bank account verification failed. Please double-check your account number and selected bank.";
    }
    return "Failed to validate your transaction details. Please check your recipient info and try again.";
  }

  // Generic/Downtime
  if (msg.includes("Service temporarily unavailable") || msg.includes("fallback_failed")) {
    return "Payment service is currently busy. Please try again in a few minutes.";
  }

  return msg;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                              MAIN COMPONENT                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function AppPage() {
  /* ─── Farcaster Mini-App SDK ready hook ─── */
  useEffect(() => {
    const initFarcaster = async () => {
      if (typeof window !== "undefined") {
        try {
          const { sdk } = await import("@farcaster/miniapp-sdk");
          await sdk.actions.ready();
          console.log("Farcaster Mini-App SDK ready on /app!");
        } catch (error) {
          console.error("Farcaster SDK ready error on /app:", error);
        }
      }
    };
    initFarcaster();
  }, []);

  /* ─── Form State ─── */
  const [side, setSide] = useState<"buy" | "sell">("sell");
  const [asset, setAsset] = useState<AssetKey>("USDC_BASE");
  const [amountCrypto, setAmountCrypto] = useState<string>("");
  const [destinationCurrency, setDestinationCurrency] = useState<(typeof CORRIDORS)[number]>("NGN");

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankCode, setBankCode] = useState<string>("");

  const [recipientName, setRecipientName] = useState<string>("");
  const [recipientAccount, setRecipientAccount] = useState<string>("");

  const [quote, setQuote] = useState<{ rate: string; feeFiat: string; receiveFiat: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [buyRate, setBuyRate] = useState<number | null>(null);
  const [onrampQuoteLoading, setOnrampQuoteLoading] = useState(false);

  const [flow, setFlow] = useState<FlowState>({ kind: "editing" });

  /* ─── Wallet Balance State ─── */
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [tokenBalanceLoading, setTokenBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [gasWarning, setGasWarning] = useState<string | null>(null);

  const assetMeta = useMemo(() => ASSETS.find((a) => a.key === asset)!, [asset]);
  const chainInfo = useMemo(() => assetMeta.chainId ? CHAIN_INFO[assetMeta.chainId] : null, [assetMeta]);
  const currencySymbol = CURRENCY_SYMBOLS[destinationCurrency] || "";

  /* ─── EVM Wallet (Wagmi) ─── */
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  /* ─── Native Gas Balance ─── */
  const { data: nativeBalance } = useBalance({
    address: address,
    chainId: assetMeta.chainId,
  });

  /* ─── Stacks Wallet ─── */
  const [stacksConnected, setStacksConnected] = useState(false);
  const [stxAddress, setStxAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const stacks = await loadStacks();
        const s = stacks.getStacksAuthState();
        setStacksConnected(s.connected);
        setStxAddress(s.stxAddress);
      } catch {
        // ignore
      }
    })();
  }, []);

  /* ─── Live Token Balance Fetching ─── */
  useEffect(() => {
    if (!isConnected || !address || !assetMeta.tokenAddress || !assetMeta.chainId) {
      setTokenBalance(null);
      setBalanceError(null);
      return;
    }

    let mounted = true;
    setTokenBalanceLoading(true);

    (async () => {
      try {
        if (!publicClient) return;
        const bal = await publicClient.readContract({
          address: assetMeta.tokenAddress!,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });
        if (!mounted) return;
        const formatted = formatUnits(bal as bigint, assetMeta.decimals);
        setTokenBalance(formatted);
        setBalanceError(null);
      } catch {
        if (!mounted) return;
        setTokenBalance(null);
      } finally {
        if (mounted) setTokenBalanceLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [isConnected, address, assetMeta.tokenAddress, assetMeta.chainId, assetMeta.decimals, publicClient, flow.kind]);

  /* ─── Gas Balance Warning ─── */
  useEffect(() => {
    if (!nativeBalance || !isConnected) {
      setGasWarning(null);
      return;
    }
    const gasEth = Number(formatUnits(nativeBalance.value, nativeBalance.decimals));
    // Warn if less than a small threshold (varies by chain)
    const threshold = assetMeta.chainId === mainnet.id ? 0.002 : 0.0005;
    if (gasEth < threshold) {
      setGasWarning(`Low ${nativeBalance.symbol} balance (${moneyPrecise(gasEth, 6)} ${nativeBalance.symbol}). You may not have enough to pay gas fees.`);
    } else {
      setGasWarning(null);
    }
  }, [nativeBalance, isConnected, assetMeta.chainId]);

  /* ─── Inline Balance Validation ─── */
  useEffect(() => {
    if (side !== "sell" || !tokenBalance || !amountCrypto || isNaN(Number(amountCrypto)) || Number(amountCrypto) <= 0) {
      setBalanceError(null);
      return;
    }
    if (Number(amountCrypto) > Number(tokenBalance)) {
      setBalanceError(`Insufficient balance. You have ${moneyPrecise(tokenBalance, 4)} ${assetMeta.label} but need ${amountCrypto}.`);
    } else {
      setBalanceError(null);
    }
  }, [amountCrypto, tokenBalance, side, assetMeta.label]);

  /* ─── Load Institutions ─── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setBanksLoading(true);
      try {
        const r = await fetch(`/api/clova/banks?currency=${destinationCurrency}`, { cache: "no-store" });
        const d = await r.json();
        const list = (d?.institutions || []) as Array<any>;
        const mapped = list
          .map((x) => ({
            name: String(x?.name || x?.institutionName || x?.label || ""),
            code: String(x?.code || x?.institutionCode || x?.id || ""),
          }))
          .filter((x) => x.name && x.code);
        if (!mounted) return;
        setInstitutions(mapped);
        setBankCode((prev) => prev || mapped[0]?.code || "");
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setBanksLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [destinationCurrency]);

  /* ─── Live Quote (Sell / Offramp) ─── */
  useEffect(() => {
    if (side !== "sell") return;
    let mounted = true;
    const t = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const r = await fetch(`/api/clova/quotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset, amountCrypto, destinationCurrency }),
        });
        const d = await r.json();
        if (!mounted) return;
        if (!r.ok) { setQuote(null); return; }
        setQuote({ rate: String(d.rate), feeFiat: String(d.feeFiat), receiveFiat: String(d.receiveFiat) });
      } catch {
        if (!mounted) return;
        setQuote(null);
      } finally {
        if (mounted) setQuoteLoading(false);
      }
    }, 300);
    return () => { mounted = false; clearTimeout(t); };
  }, [asset, amountCrypto, destinationCurrency, side]);

  /* ─── Live Buy Rate (Buy / Onramp) ─── */
  useEffect(() => {
    if (side !== "buy") return;
    let mounted = true;
    const t = setTimeout(async () => {
      setOnrampQuoteLoading(true);
      try {
        const paycrestAsset = ASSETS.find((a) => a.key === asset)!;
        const r = await fetch(`/api/clova/onramp/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            network: NETWORK_MAP[paycrestAsset.chainId || 0] || "base",
            token: paycrestAsset.label,
            amount: "1",
            fiat: destinationCurrency,
          }),
        });
        const d = await r.json();
        if (!mounted) return;
        if (r.ok && d?.buy?.rate) {
          setBuyRate(Number(d.buy.rate));
        } else {
          setBuyRate(null);
        }
      } catch {
        if (!mounted) return;
        setBuyRate(null);
      } finally {
        if (mounted) setOnrampQuoteLoading(false);
      }
    }, 400);
    return () => { mounted = false; clearTimeout(t); };
  }, [asset, destinationCurrency, side]);

  const onrampCalculations = useMemo(() => {
    if (side !== "buy" || !buyRate || !amountCrypto || isNaN(Number(amountCrypto))) return null;
    const grossFiat = Number(amountCrypto);
    const platformFee = grossFiat * 0.015;
    const netFiat = grossFiat - platformFee;
    const cryptoReceived = netFiat / buyRate;
    return {
      cryptoReceived: cryptoReceived.toFixed(6),
      feeFiat: platformFee.toFixed(2),
      buyRate,
    };
  }, [side, buyRate, amountCrypto]);

  /* ─── Wallet Actions ─── */
  async function connectEvmWallet() {
    if (!connectors.length) throw new Error("No wallet connectors available");

    // Check if we are running inside a Farcaster client iframe/context
    const isFarcaster = typeof window !== "undefined" && (
      window.parent !== window || 
      /farcaster/i.test(navigator.userAgent)
    );

    if (isFarcaster) {
      const fcConnector = connectors.find(
        (c) => c.id === "farcasterMiniApp" || c.name.toLowerCase().includes("farcaster")
      );
      if (fcConnector) {
        return await connectAsync({ connector: fcConnector });
      }
    }

    // Default to standard injected (MetaMask, MiniPay, trust, etc.) for standard Web/MiniPay
    const injectedConnector = connectors.find((c) => c.id === "injected");
    if (injectedConnector) {
      return await connectAsync({ connector: injectedConnector });
    }

    // Fallback to the first available connector if no matches found
    return await connectAsync({ connector: connectors[0] });
  }

  async function ensureEvmChain(targetChainId: number) {
    if (!chainId) return;
    if (chainId === targetChainId) return;
    await switchChainAsync({ chainId: targetChainId });
  }

  /* ─── Order Creation ─── */
  async function createOrder(): Promise<Order> {
    if (!recipientName.trim()) throw new Error("Recipient name is required");
    if (!recipientAccount.trim() || recipientAccount.trim().length < 7) throw new Error("Account number is too short");
    if (!bankCode) throw new Error("Pick a bank/institution");

    const payload: CreateOrderInput = {
      asset,
      amountCrypto,
      destinationCurrency,
      recipient: {
        accountName: recipientName.trim(),
        accountNumber: recipientAccount.trim(),
        bankCode,
      },
      returnAddress: address || undefined,
    };

    const r = await fetch(`/api/clova/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.userMessage || d?.detail || d?.error || "Failed to create order");
    return d as Order;
  }

  async function sendDepositEvm(order: Order): Promise<`0x${string}`> {
    if (!assetMeta.tokenAddress || !assetMeta.chainId) throw new Error("Unsupported EVM asset config");
    if (!address) throw new Error("Connect a wallet first");

    await ensureEvmChain(assetMeta.chainId);

    const value = parseUnits(order.amountCrypto, assetMeta.decimals);
    const txHash = await writeContractAsync({
      address: assetMeta.tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [order.depositAddress as `0x${string}`, value],
      account: address,
    });

    return txHash;
  }

  async function confirmDeposit(order: Order, txHash: string) {
    const r = await fetch(`/api/clova/settlements/credited`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.orderId,
        asset: order.asset,
        amountCrypto: order.amountCrypto,
        txHash,
        confirmations: 1,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.detail || d?.error || "Failed to confirm deposit");
    return d;
  }

  /* ─── Onramp Order Status Polling ─── */
  useEffect(() => {
    if (flow.kind !== "deposit_sent" || !("order" in flow) || flow.order.direction !== "onramp") return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/clova/onramp/order/${flow.order.orderId}`);
        if (!res.ok) return;
        const updated = await res.json();

        if (!active) return;
        if (updated.status === "settled" || updated.status === "completed" || updated.status === "paid") {
          setFlow({ kind: "done", order: updated });
          clearInterval(interval);
        } else if (updated.status === "failed" || updated.status === "expired") {
          setFlow({ kind: "error", message: `Order ${updated.status}. Please try again or contact support.` });
          clearInterval(interval);
        }
      } catch (err) {
        console.warn("Polling status failed:", err);
      }
    }, 5000);

    return () => { active = false; clearInterval(interval); };
  }, [flow]);

  /* ─── Onramp Order Creation ─── */
  async function createOnrampOrder(): Promise<any> {
    if (!recipientName.trim()) throw new Error("Refund account name is required");
    if (!recipientAccount.trim() || recipientAccount.trim().length < 7) throw new Error("Refund account number is too short");
    if (!bankCode) throw new Error("Pick a bank/institution");

    const payload = {
      destinationAsset: asset,
      amount: amountCrypto,
      amountIn: "fiat",
      sourceCurrency: destinationCurrency,
      refundAccount: {
        bankCode,
        accountNumber: recipientAccount.trim(),
        accountName: recipientName.trim(),
      },
      recipientAddress: address || stxAddress || "",
    };

    if (!payload.recipientAddress) {
      throw new Error("Connect a wallet to receive your crypto");
    }

    const r = await fetch(`/api/clova/onramp/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.detail || d?.error || "Failed to create onramp order");
    return d;
  }

  async function onSubmitOnramp() {
    try {
      let currentAddress = address;
      let currentStxAddress = stxAddress;

      if (assetMeta.kind === "evm") {
        if (!isConnected || !currentAddress) {
          const res = await connectEvmWallet();
          if (res?.accounts?.length) {
            currentAddress = res.accounts[0] as `0x${string}`;
          } else {
            throw new Error("Failed to connect wallet");
          }
        }
      } else {
        if (!stacksConnected || !currentStxAddress) {
          const stacks = await loadStacks();
          await stacks.connectLeather();
          const s = stacks.getStacksAuthState();
          if (!s.connected || !s.stxAddress) throw new Error("Wallet connection failed");
          setStacksConnected(true);
          setStxAddress(s.stxAddress);
          currentStxAddress = s.stxAddress;
        }
      }

      setFlow({ kind: "creating_order" });
      const order = await createOnrampOrder();
      setFlow({ kind: "deposit_sent", order });
    } catch (e: any) {
      setFlow({ kind: "error", message: e?.message || String(e) });
    }
  }

  function resetForm() {
    setAmountCrypto("");
    setRecipientName("");
    setRecipientAccount("");
    setQuote(null);
    setBuyRate(null);
    setBalanceError(null);
    setFlow({ kind: "editing" });
  }

  async function onSubmitOrder() {
    if (flow.kind === "done") {
      resetForm();
      return;
    }
    if (side === "sell") {
      await onCashout();
    } else {
      await onSubmitOnramp();
    }
  }

  async function onCashout() {
    try {
      let currentAddress = address;

      // 1. Connection and balance checks
      if (assetMeta.kind === "evm") {
        if (!isConnected || !currentAddress) {
          const res = await connectEvmWallet();
          if (res?.accounts?.length) {
            currentAddress = res.accounts[0] as `0x${string}`;
          } else {
            throw new Error("Failed to connect wallet");
          }
        }
        await ensureEvmChain(assetMeta.chainId!);

        // Token balance check
        if (publicClient && currentAddress && assetMeta.tokenAddress) {
          try {
            const bal = await publicClient.readContract({
              address: assetMeta.tokenAddress,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [currentAddress as `0x${string}`],
            });
            const needed = parseUnits(amountCrypto, assetMeta.decimals);
            if ((bal as bigint) < needed) {
              const available = formatUnits(bal as bigint, assetMeta.decimals);
              throw new Error(`Insufficient ${assetMeta.label} balance. You have ${moneyPrecise(available, 4)} but need ${amountCrypto}.`);
            }
          } catch (err: any) {
            if (err?.message?.includes("Insufficient") || err?.message?.includes("balance")) throw err;
            console.warn("Could not verify balance:", err);
          }
        }

        // Gas check
        if (nativeBalance) {
          const gasEth = Number(formatUnits(nativeBalance.value, nativeBalance.decimals));
          const threshold = assetMeta.chainId === mainnet.id ? 0.002 : 0.0005;
          if (gasEth < threshold) {
            throw new Error(`Insufficient gas. You need ${nativeBalance.symbol} to pay transaction fees. Current balance: ${moneyPrecise(gasEth, 6)} ${nativeBalance.symbol}`);
          }
        }
      } else {
        if (!stacksConnected || !stxAddress) {
          const stacks = await loadStacks();
          await stacks.connectLeather();
          const s = stacks.getStacksAuthState();
          if (!s.connected || !s.stxAddress) throw new Error("Wallet connection failed");
          setStacksConnected(true);
          setStxAddress(s.stxAddress);
        }
      }

      setFlow({ kind: "creating_order" });
      const order = await createOrder();

      if (assetMeta.kind === "evm") {
        setFlow({ kind: "awaiting_wallet", order });
        const txHash = await sendDepositEvm(order);
        setFlow({ kind: "deposit_sent", order, txHash });
        setFlow({ kind: "confirming", order, txHash });
        await confirmDeposit(order, txHash);
        setFlow({ kind: "done", order, txHash });
        return;
      }

      setFlow({ kind: "deposit_sent", order });
    } catch (e: any) {
      setFlow({ kind: "error", message: e?.message || String(e) });
    }
  }

  const cta = useMemo(() => {
    if (flow.kind === "creating_order") return { label: "Creating order…", disabled: true };
    if (flow.kind === "awaiting_wallet") return { label: "Confirm in wallet…", disabled: true };
    if (flow.kind === "confirming") return { label: "Processing…", disabled: true };
    if (flow.kind === "done") return { label: "Start New Transaction", disabled: false };
    if (balanceError && side === "sell") return { label: "Insufficient Balance", disabled: true };
    return { label: side === "sell" ? "Cash out" : "Buy Crypto", disabled: false };
  }, [flow.kind, side, balanceError]);

  const isFormActive = flow.kind === "editing" || flow.kind === "error";

  /* ═════════════════════════════════ RENDER ═════════════════════════════════ */

  return (
    <div className="min-h-screen bg-[#050a14] text-zinc-50 relative overflow-x-hidden selection:bg-blue-500 selection:text-white">
      {/* ─── Animated Mesh Background ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="mesh-orb-1 absolute -top-32 -right-32 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[150px]" />
        <div className="mesh-orb-2 absolute top-1/2 -left-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[130px]" />
        <div className="mesh-orb-3 absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      {/* ─── Main Content ─── */}
      <div className="relative z-10 mx-auto max-w-lg px-4 pt-8 md:pt-14 pb-48">

        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">Clova Pay</h1>
                <p className="text-[11px] text-gray-500 font-medium">Multi-chain stablecoin gateway</p>
              </div>
            </div>

            {/* Wallet Button */}
            <WalletButton
              isConnected={isConnected}
              address={address}
              chainInfo={chainInfo}
              onConnect={async () => {
                try {
                  if (isConnected) await disconnectAsync();
                  else await connectEvmWallet();
                } catch (e: any) {
                  setFlow({ kind: "error", message: e?.message || "Wallet action failed" });
                }
              }}
            />
          </div>

          {/* ─── Wallet Balance Strip ─── */}
          <AnimatePresence>
            {isConnected && address && assetMeta.kind === "evm" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 flex-wrap">
                  {/* Token Balance */}
                  <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5 border border-white/5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${chainInfo?.color}20`, color: chainInfo?.color }}>
                      {chainInfo?.icon}
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-400">{assetMeta.label}:</span>{" "}
                      <span className="font-semibold text-white">
                        {tokenBalanceLoading ? "…" : tokenBalance ? moneyPrecise(tokenBalance, 4) : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Gas Balance */}
                  <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5 border border-white/5">
                    <Fuel className="w-3.5 h-3.5 text-gray-400" />
                    <div className="text-xs">
                      <span className="text-gray-400">Gas:</span>{" "}
                      <span className={cn("font-semibold", gasWarning ? "text-amber-400" : "text-white")}>
                        {nativeBalance ? `${moneyPrecise(formatUnits(nativeBalance.value, nativeBalance.decimals), 5)} ${nativeBalance.symbol}` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Chain Indicator */}
                  <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-dot" />
                    {chainInfo?.name || "Unknown"}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── Gas Warning Banner ─── */}
        <AnimatePresence>
          {gasWarning && side === "sell" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200 leading-relaxed">{gasWarning}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Buy / Sell Toggle ─── */}
        <div className="flex p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl mb-6 relative overflow-hidden backdrop-blur-xl">
          <motion.div
            layout
            className="absolute top-1 bottom-1 rounded-xl"
            animate={{
              left: side === "sell" ? "4px" : "calc(50% + 2px)",
              right: side === "sell" ? "calc(50% + 2px)" : "4px",
              background: side === "sell"
                ? "linear-gradient(135deg, #3b82f6, #6366f1)"
                : "linear-gradient(135deg, #10b981, #059669)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ boxShadow: side === "sell" ? "0 4px 20px rgba(59,130,246,0.3)" : "0 4px 20px rgba(16,185,129,0.3)" }}
          />
          <button
            onClick={() => { setSide("sell"); setAmountCrypto(""); setQuote(null); }}
            className={cn(
              "flex-1 py-3 text-center text-sm font-semibold rounded-xl relative z-10 transition-all duration-200 focus:outline-none flex items-center justify-center gap-2",
              side === "sell" ? "text-white" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            Cash Out
          </button>
          <button
            onClick={() => { setSide("buy"); setAmountCrypto(""); setBuyRate(null); }}
            className={cn(
              "flex-1 py-3 text-center text-sm font-semibold rounded-xl relative z-10 transition-all duration-200 focus:outline-none flex items-center justify-center gap-2",
              side === "buy" ? "text-white" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Buy Crypto
          </button>
        </div>

        {/* ─── Error Banner ─── */}
        <AnimatePresence>
          {flow.kind === "error" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-6 overflow-hidden"
            >
              <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/20 to-transparent backdrop-blur-xl p-5 shadow-xl shadow-red-950/30 relative">
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-red-500/30 via-red-500 to-transparent" />
                
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Error Header Title */}
                    <div className="text-[10px] font-bold tracking-widest text-red-400 uppercase mb-1">
                      {flow.message.includes("Account validation") || flow.message.includes("verify") 
                        ? "Account Verification Warning" 
                        : "Transaction Alert"}
                    </div>
                    
                    {/* Main Error Description */}
                    <p className="text-sm font-semibold text-white leading-snug">
                      {formatErrorMessage(flow.message)}
                    </p>

                    {/* Step-by-Step Resolution Guide */}
                    {(flow.message.includes("Account validation") || flow.message.includes("verify") || flow.message.includes("paycrest_order_failed")) && (
                      <div className="mt-4 border-t border-white/[0.05] pt-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                          Standard Resolution Checklist:
                        </p>
                        <ul className="text-xs text-gray-400 space-y-2">
                          <li className="flex items-start gap-2">
                            <span className="text-red-400 font-bold">•</span>
                            <span>Verify the **account number** has exactly 10 digits.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400 font-bold">•</span>
                            <span>Double-check that the correct **recipient bank** is selected.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400 font-bold">•</span>
                            <span>If the bank network is congested, try again in a few minutes.</span>
                          </li>
                        </ul>
                      </div>
                    )}

                    {/* Actionable Resolution Row */}
                    <div className="mt-5 flex flex-wrap items-center gap-3.5 pt-3 border-t border-white/[0.05]">
                      <button
                        onClick={() => setFlow({ kind: "editing" })}
                        className="rounded-xl bg-red-500/15 border border-red-500/30 px-3.5 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/25 transition-all"
                      >
                        Dismiss & Edit Info
                      </button>
                      <a
                        href="https://t.me/gabrieltemtsen"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] px-3.5 py-2 text-xs font-semibold text-gray-300 transition-all inline-flex items-center gap-1.5"
                      >
                        <span>✈️</span> Support Chat
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Main Content Area ─── */}
        <div className="grid gap-5 relative">
          <AnimatePresence mode="wait">
            {isFormActive ? (
              <motion.div
                key="form-fields"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="grid gap-5"
              >
                {/* ═══ Asset & Currency Selection ═══ */}
                <GlassCard delay={0.05}>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                      Transfer Details
                    </span>
                  </div>

                  <div className="grid gap-5">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Asset Selector */}
                      <div>
                        <FieldLabel>Crypto Asset</FieldLabel>
                        <div className="relative">
                          <select
                            value={asset}
                            onChange={(e) => { setAsset(e.target.value as AssetKey); setQuote(null); setBuyRate(null); }}
                            className="w-full appearance-none rounded-xl glass-input px-3.5 py-3 text-sm font-medium text-white focus:outline-none pr-8"
                          >
                            {ASSETS.map((a) => (
                              <option key={a.key} value={a.key} className="bg-[#0c1220]">
                                {a.label} · {a.chainLabel}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                        </div>
                      </div>

                      {/* Currency Selector */}
                      <div>
                        <FieldLabel>{side === "sell" ? "Payout Fiat" : "Deposit Fiat"}</FieldLabel>
                        <div className="relative">
                          <select
                            value={destinationCurrency}
                            onChange={(e) => { setDestinationCurrency(e.target.value as any); setQuote(null); setBuyRate(null); }}
                            className="w-full appearance-none rounded-xl glass-input px-3.5 py-3 text-sm font-medium text-white focus:outline-none pr-8"
                          >
                            {CORRIDORS.map((c) => (
                              <option key={c} value={c} className="bg-[#0c1220]">{c}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* ─── Amount Input ─── */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <FieldLabel>{side === "sell" ? "Amount" : "Spend"}</FieldLabel>
                        {side === "sell" && tokenBalance && (
                          <button
                            onClick={() => setAmountCrypto(String(Math.floor(Number(tokenBalance))))}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/15 px-2 py-0.5 rounded-md transition-all border border-blue-500/10"
                          >
                            MAX
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          value={amountCrypto}
                          onChange={(e) => setAmountCrypto(e.target.value)}
                          inputMode="decimal"
                          className={cn(
                            "w-full rounded-xl glass-input pl-4 pr-24 py-4 text-2xl font-bold text-white focus:outline-none placeholder:text-gray-700 transition-all",
                            balanceError && side === "sell" ? "border-red-500/40 focus:border-red-500/50" : ""
                          )}
                          placeholder={side === "sell" ? "0.00" : "0"}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-blue-400 bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/15">
                          {side === "sell" ? assetMeta.label : destinationCurrency}
                        </div>
                      </div>

                      {/* Balance Error */}
                      <AnimatePresence>
                        {balanceError && side === "sell" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2"
                          >
                            <p className="text-xs text-red-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {balanceError}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Range Slider */}
                      <div className="mt-3 px-0.5">
                        <input
                          type="range"
                          min={side === "sell" ? "1" : "500"}
                          max={side === "sell" ? (tokenBalance ? Math.floor(Number(tokenBalance)).toString() : "500") : "500000"}
                          step={side === "sell" ? "1" : "500"}
                          value={Number(amountCrypto || 0)}
                          onChange={(e) => setAmountCrypto(String(e.target.value))}
                          className="w-full cursor-pointer focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>

                    {/* ─── Quote Preview ─── */}
                    <AnimatePresence>
                      {amountCrypto && Number(amountCrypto) > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, scale: 0.97 }}
                          animate={{ opacity: 1, height: "auto", scale: 1 }}
                          exit={{ opacity: 0, height: 0, scale: 0.97 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className={cn(
                            "rounded-xl border p-4",
                            side === "sell"
                              ? "border-emerald-500/15 bg-emerald-500/5"
                              : "border-blue-500/15 bg-blue-500/5"
                          )}>
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingUp className={cn("w-3.5 h-3.5", side === "sell" ? "text-emerald-400" : "text-blue-400")} />
                              <span className={cn("text-[10px] font-bold uppercase tracking-widest", side === "sell" ? "text-emerald-400/70" : "text-blue-400/70")}>
                                {side === "sell" ? "Recipient gets (est.)" : "You receive (est.)"}
                              </span>
                            </div>
                            <div className="text-2xl font-extrabold tracking-tight text-white animate-fade-in-up">
                              {side === "sell"
                                ? (quoteLoading ? "…" : quote ? `${currencySymbol}${money(quote.receiveFiat)}` : "—")
                                : (onrampQuoteLoading ? "…" : onrampCalculations ? `${moneyPrecise(onrampCalculations.cryptoReceived, 4)} ${assetMeta.label}` : "—")}
                            </div>
                            <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                              {side === "sell" ? (
                                <>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Fee</span>
                                    <span className="font-mono text-gray-400">{quoteLoading ? "…" : quote ? `${currencySymbol}${money(quote.feeFiat)}` : "—"}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Rate</span>
                                    <span className="font-mono text-gray-400">{quoteLoading ? "…" : quote ? `1 ${assetMeta.label} = ${currencySymbol}${money(quote.rate)}` : "—"}</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Platform Fee (1.5%)</span>
                                    <span className="font-mono text-gray-400">{onrampQuoteLoading ? "…" : onrampCalculations ? `${currencySymbol}${money(onrampCalculations.feeFiat)}` : "—"}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Buy Rate</span>
                                    <span className="font-mono text-gray-400">{onrampQuoteLoading ? "…" : onrampCalculations ? `${currencySymbol}${money(onrampCalculations.buyRate)} / ${assetMeta.label}` : "—"}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </GlassCard>

                {/* ═══ Recipient Details ═══ */}
                <CollapsibleCard
                  title={side === "sell" ? "Recipient Details" : "Refund Account"}
                  subtitle={recipientName ? `${recipientName} • ${institutions.find(i => i.code === bankCode)?.name || ""}` : (side === "sell" ? "Bank account for payout" : "For failed transaction refunds")}
                  delay={0.15}
                >
                  <div className="grid gap-4 pt-1">
                    <div>
                      <FieldLabel>Full name</FieldLabel>
                      <input
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="w-full rounded-xl glass-input px-3.5 py-3 text-sm font-medium text-white focus:outline-none placeholder:text-gray-600"
                        placeholder="Jane Doe"
                      />
                    </div>

                    <div>
                      <FieldLabel>Bank / Institution</FieldLabel>
                      <div className="relative">
                        <select
                          value={bankCode}
                          onChange={(e) => setBankCode(e.target.value)}
                          className="w-full appearance-none rounded-xl glass-input px-3.5 py-3 text-sm font-medium text-white focus:outline-none pr-8 disabled:opacity-40"
                          disabled={banksLoading}
                        >
                          {institutions.map((b) => (
                            <option key={b.code} value={b.code} className="bg-[#0c1220]">{b.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                      </div>
                      {banksLoading && <p className="mt-1 text-[10px] text-gray-500">Loading institutions…</p>}
                    </div>

                    <div>
                      <FieldLabel>Account number</FieldLabel>
                      <input
                        value={recipientAccount}
                        onChange={(e) => setRecipientAccount(e.target.value)}
                        className="w-full rounded-xl glass-input px-3.5 py-3 text-sm font-medium text-white focus:outline-none placeholder:text-gray-600"
                        placeholder="0123456789"
                      />
                    </div>
                  </div>
                </CollapsibleCard>

                {/* ═══ Buy Mode: Wallet Address Notice ═══ */}
                {side === "buy" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden">
                    <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div className="text-xs text-gray-400 leading-relaxed flex-1 min-w-0">
                        <span className="font-semibold text-gray-200">Receiving Wallet</span>
                        {isConnected && address ? (
                          <span className="font-mono text-blue-300 break-all block mt-1">{address}</span>
                        ) : (
                          <span className="text-amber-400 block mt-1">Connect your wallet to receive crypto.</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              /* ═══ Transaction Progress View ═══ */
              <motion.div
                key="transaction-progress"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="grid gap-5"
              >
                <TransactionProgressCard flow={flow} onBack={resetForm} assetMeta={assetMeta} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Support / Help Section ─── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            whileHover={{ opacity: 1 }}
            className="mt-10 text-center transition-opacity duration-300"
          >
            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2.5 font-bold">
              Need assistance with your cashout?
            </p>
            <div className="inline-flex items-center justify-center gap-4 bg-white/[0.02] border border-white/[0.04] backdrop-blur-md rounded-2xl px-4.5 py-2.5 text-xs text-gray-400">
              <a 
                href="https://warpcast.com/gabedev.eth" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 font-medium"
              >
                <span className="text-[10px]">🟣</span> Warpcast
              </a>
              <div className="w-px h-3 bg-white/10" />
              <a 
                href="https://t.me/gabrieltemtsen" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 font-medium"
              >
                <span className="text-[10px]">✈️</span> Telegram
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── Sticky CTA ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-gradient-to-t from-[#050a14] via-[#050a14]/95 to-transparent pointer-events-none" />
        <div className="relative border-t border-white/[0.04]">
          <div className="mx-auto max-w-lg px-4 py-5">
            <button
              onClick={onSubmitOrder}
              disabled={cta.disabled}
              className={cn(
                "shimmer-sweep group relative w-full overflow-hidden rounded-2xl px-4 py-4 text-base font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#050a14] transition-all duration-300",
                flow.kind === "done"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 focus:ring-emerald-500 shadow-lg shadow-emerald-500/20"
                  : balanceError && side === "sell"
                    ? "bg-gradient-to-r from-red-600/60 to-red-700/60 cursor-not-allowed opacity-70"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 focus:ring-blue-500 glow-pulse",
                cta.disabled && flow.kind !== "done" ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              <span className="relative flex items-center justify-center gap-2">
                {cta.disabled && flow.kind !== "done" && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                {flow.kind === "done" && <CheckCircle2 className="w-4.5 h-4.5" />}
                {cta.label}
              </span>
            </button>

            <p className="mt-2.5 text-center text-[10px] text-gray-500 flex items-center justify-center gap-1.5">
              <Shield className="w-3 h-3" />
              {side === "sell" ? "Secured by on-chain verification" : "Funds transfer is fully encrypted"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            SUB-COMPONENTS                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Wallet Connect Button ─── */
function WalletButton({ isConnected, address, chainInfo, onConnect }: {
  isConnected: boolean;
  address?: `0x${string}`;
  chainInfo: { name: string; icon: string; color: string } | null;
  onConnect: () => void;
}) {
  return (
    <button
      onClick={onConnect}
      className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md px-3.5 py-2 text-xs font-medium text-white hover:bg-white/[0.06] transition-all"
    >
      {isConnected && chainInfo && (
        <span className="text-sm">{chainInfo.icon}</span>
      )}
      <div className={cn(
        "w-5 h-5 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
        isConnected ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"
      )}>
        {isConnected ? <CheckCircle2 className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
      </div>
      <span className="font-mono text-[11px]">
        {isConnected && address ? shorten(address) : "Connect"}
      </span>
    </button>
  );
}

/* ─── Glass Card ─── */
function GlassCard({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card rounded-2xl p-5 md:p-6 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-50" />
      {children}
    </motion.div>
  );
}

/* ─── Field Label ─── */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[10px] font-bold tracking-wider text-gray-500 uppercase">{children}</div>;
}

/* ─── Collapsible Card ─── */
function CollapsibleCard({ title, subtitle, delay = 0, children }: {
  title: string; subtitle: string; delay?: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card rounded-2xl overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-50" />
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 md:px-6 py-4 flex items-center justify-between gap-3 hover:bg-white/[0.01] transition-colors group"
      >
        <div className="text-left flex-1 min-w-0">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</div>
          <div className="mt-0.5 text-xs text-gray-600 truncate">{subtitle}</div>
        </div>
        <div className={cn(
          "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] transition-transform duration-300 group-hover:bg-white/[0.06]",
          open ? "rotate-180" : ""
        )}>
          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="px-5 md:px-6 pb-5 md:pb-6 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Copy Button ─── */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={cn(
        "shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all flex items-center gap-1",
        copied ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "border border-white/[0.06] bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/* ─── Explorer URL Helper ─── */
function getExplorerUrl(asset: AssetKey, txHash: string): string {
  if (asset.includes("BASE")) return `https://basescan.org/tx/${txHash}`;
  if (asset.includes("CELO")) return `https://celoscan.io/tx/${txHash}`;
  if (asset.includes("ARBITRUM")) return `https://arbiscan.io/tx/${txHash}`;
  if (asset.includes("POLYGON")) return `https://polygonscan.com/tx/${txHash}`;
  if (asset.includes("ETHEREUM")) return `https://etherscan.io/tx/${txHash}`;
  if (asset.includes("BSC")) return `https://bscscan.com/tx/${txHash}`;
  if (asset.includes("SCROLL")) return `https://scrollscan.com/tx/${txHash}`;
  if (asset.includes("LISK")) return `https://blockscout.lisk.com/tx/${txHash}`;
  return `https://explorer.hiro.so/txid/${txHash}?chain=mainnet`;
}

/* ─── Countdown Timer ─── */
function CountdownTimer({ validUntil }: { validUntil: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const target = new Date(validUntil).getTime();
    if (isNaN(target)) return;

    const update = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s.toString().padStart(2, "0")}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [validUntil]);

  if (!timeLeft) return null;

  return (
    <div className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border-amber-500/15">
      <Clock className="w-3 h-3" />
      <span className="font-mono">{timeLeft}</span>
    </div>
  );
}

/* ─── Step Progress ─── */
function StepProgress({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { label: "Create", icon: "1" },
    { label: "Transfer", icon: "2" },
    { label: "Settle", icon: "3" },
  ];

  return (
    <div className="relative flex items-center justify-between w-full mb-6 px-2">
      {/* Background Line */}
      <div className="absolute left-6 right-6 top-4 h-[2px] bg-white/[0.06] z-0" />
      {/* Active Fill */}
      <motion.div
        className="absolute left-6 top-4 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 z-0"
        initial={{ width: "0%" }}
        animate={{ width: step === 1 ? "0%" : step === 2 ? "50%" : "100%" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ maxWidth: "calc(100% - 48px)" }}
      />

      {steps.map((s, idx) => {
        const num = (idx + 1) as 1 | 2 | 3;
        const isActive = step >= num;
        const isCurrent = step === num;
        return (
          <div key={idx} className="relative z-10 flex flex-col items-center">
            <motion.div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 border",
                step > num
                  ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                  : isCurrent
                    ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                    : "bg-white/[0.03] text-gray-600 border-white/[0.06]"
              )}
              animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
              transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
            >
              {step > num ? <CheckCircle2 className="w-4 h-4" /> : s.icon}
            </motion.div>
            <span className={cn(
              "text-[9px] uppercase tracking-wider font-bold mt-1.5",
              isActive ? "text-blue-400" : "text-gray-600"
            )}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Transaction Progress Card ─── */
function TransactionProgressCard({ flow, onBack, assetMeta }: {
  flow: FlowState;
  onBack: () => void;
  assetMeta: typeof ASSETS[number];
}) {
  if (flow.kind === "editing" || flow.kind === "error") return null;

  const step = flow.kind === "creating_order"
    ? 1
    : (flow.kind === "awaiting_wallet" || flow.kind === "deposit_sent") ? 2
    : (flow.kind === "confirming" || flow.kind === "done") ? 3
    : 1;

  const order = "order" in flow ? flow.order : null;
  const txHash = "txHash" in flow ? flow.txHash : undefined;

  return (
    <GlassCard delay={0.05}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-6 h-6 rounded-lg flex items-center justify-center",
            flow.kind === "done" ? "bg-emerald-500/10" : "bg-blue-500/10"
          )}>
            {flow.kind === "done" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            )}
          </div>
          <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
            {flow.kind === "done" ? "Complete" : "Processing"}
          </span>
        </div>

        {flow.kind !== "done" && flow.kind !== "creating_order" && (
          <button
            onClick={onBack}
            className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Cancel
          </button>
        )}
      </div>

      <StepProgress step={step} />

      <AnimatePresence mode="wait">
        {/* Creating Order */}
        {flow.kind === "creating_order" && (
          <motion.div key="creating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center py-8 space-y-4"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
              <Loader2 className="w-14 h-14 text-blue-500 animate-spin relative z-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Creating Secure Order</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">Locking conversion rates and initializing your transaction…</p>
            </div>
          </motion.div>
        )}

        {/* Awaiting Wallet */}
        {flow.kind === "awaiting_wallet" && (
          <motion.div key="awaiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center py-8 space-y-4"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />
              <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 relative z-10 animate-bounce">
                <Wallet className="w-7 h-7" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Approve in Wallet</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">Confirm the token transfer in your connected wallet.</p>
            </div>
          </motion.div>
        )}

        {/* Deposit Sent / Confirming */}
        {(flow.kind === "deposit_sent" || flow.kind === "confirming") && order && (
          <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Onramp: Bank Deposit Instructions */}
            {order.direction === "onramp" && order.providerAccount && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Action Required</span>
                    <h3 className="text-base font-bold text-white mt-0.5">Transfer to Virtual Account</h3>
                  </div>
                  {order.providerAccount.validUntil && (
                    <CountdownTimer validUntil={order.providerAccount.validUntil} />
                  )}
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  Send exactly <span className="font-extrabold text-emerald-400 text-sm">{money(order.providerAccount.amountToTransfer)} {order.providerAccount.currency}</span> to:
                </p>

                <div className="rounded-xl bg-black/30 border border-white/[0.04] p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-wider">Bank</div>
                      <div className="font-semibold text-white text-sm mt-0.5">{order.providerAccount.institution}</div>
                    </div>
                  </div>
                  <div className="border-t border-white/[0.04] pt-3 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-wider">Account Number</div>
                      <div className="font-mono text-sm text-blue-200 mt-0.5 font-bold tracking-wide">{order.providerAccount.accountIdentifier}</div>
                    </div>
                    <CopyButton value={order.providerAccount.accountIdentifier || ""} />
                  </div>
                  <div className="border-t border-white/[0.04] pt-3 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-wider">Account Name</div>
                      <div className="font-semibold text-white text-sm mt-0.5">{order.providerAccount.accountName}</div>
                    </div>
                    <CopyButton value={order.providerAccount.accountName || ""} />
                  </div>
                </div>

                {/* Listening indicator */}
                <div className="rounded-xl border border-blue-500/10 bg-blue-500/5 p-3 flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                  </span>
                  <span className="text-[10px] text-blue-300 font-medium">
                    Monitoring bank networks for your deposit…
                  </span>
                </div>
              </div>
            )}

            {/* Offramp: EVM Confirming */}
            {order.direction !== "onramp" && order.asset !== "USDCX_STACKS" && (
              <div className="flex flex-col items-center text-center py-8 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />
                  <Loader2 className="w-14 h-14 text-indigo-400 animate-spin relative z-10" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Settling On-Chain</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">Waiting for block confirmations…</p>
                  {txHash && (
                    <div className="mt-3 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] inline-flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">Tx:</span>
                      <span className="font-mono text-[10px] text-blue-300">{shorten(txHash, 10, 8)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Offramp: Stacks Manual */}
            {order.direction !== "onramp" && order.asset === "USDCX_STACKS" && (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Manual Transfer</span>
                  <h3 className="text-base font-bold text-white mt-0.5">Send Stacks Stablecoins</h3>
                </div>
                <p className="text-xs text-gray-400">
                  Send <span className="font-bold text-blue-400">{order.amountCrypto} USDCx</span> to:
                </p>
                <div className="rounded-xl bg-black/30 border border-white/[0.04] p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="text-[10px] text-gray-600 uppercase tracking-wider">Contract</div>
                      <div className="font-mono text-xs text-blue-200 mt-0.5 truncate select-all">{order.depositAddress}</div>
                    </div>
                    <CopyButton value={order.depositAddress || ""} />
                  </div>
                  {(order as any).depositMemo && (
                    <div className="border-t border-white/[0.04] pt-3 flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider">Memo</div>
                        <div className="font-mono text-xs text-blue-200 mt-0.5 select-all">{String((order as any).depositMemo)}</div>
                      </div>
                      <CopyButton value={String((order as any).depositMemo)} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Done / Success */}
        {flow.kind === "done" && order && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center py-4"
          >
            {/* Success Icon */}
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl confetti-burst" />
              <div className="success-ring relative w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-1">Transaction Complete</h3>
            <p className="text-xs text-gray-500 max-w-sm mb-5">
              {order.direction === "onramp"
                ? "Deposit received — stablecoins sent to your wallet!"
                : "Stablecoin converted — fiat payout processed!"}
            </p>

            {/* Receipt */}
            <div className="w-full rounded-xl border border-white/[0.04] bg-black/20 p-5 relative overflow-hidden text-left space-y-3">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500/30 via-blue-500/30 to-purple-500/30" />

              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Receipt</div>

              <div className="flex justify-between items-baseline border-b border-white/[0.04] pb-3">
                <span className="text-[10px] text-gray-500">Charged</span>
                <span className="text-base font-bold text-white">
                  {order.direction === "onramp"
                    ? `${money(order.providerAccount?.amountToTransfer || "")} ${order.providerAccount?.currency || ""}`
                    : `${money(order.amountCrypto)} ${assetMeta.label}`}
                </span>
              </div>

              <div className="flex justify-between items-baseline border-b border-white/[0.04] pb-3">
                <span className="text-[10px] text-gray-500">Received</span>
                <span className="text-base font-bold text-emerald-400">
                  {order.direction === "onramp"
                    ? `${money(order.amountCrypto)} ${assetMeta.label}`
                    : `${CURRENCY_SYMBOLS[order.destinationCurrency || ""] || ""}${money(order.receiveFiat)}`}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-600">Order ID</span>
                  <span className="font-mono text-gray-400 select-all">{order.orderId}</span>
                </div>

                {order.direction === "onramp" ? (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">Destination</span>
                    <span className="font-mono text-blue-300 max-w-[180px] text-right truncate select-all">
                      {order.recipientAddress ? shorten(order.recipientAddress, 8, 8) : "—"}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">Recipient</span>
                    <span className="text-gray-400 text-right">{order.recipientName} • {order.recipientAccount}</span>
                  </div>
                )}

                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-600">Rate</span>
                  <span className="text-gray-400">
                    {order.direction === "onramp"
                      ? `1 ${assetMeta.label} = ${CURRENCY_SYMBOLS[order.destinationCurrency || ""] || ""}${money(order.rate)}`
                      : `1 ${assetMeta.label} = ${CURRENCY_SYMBOLS[order.destinationCurrency || ""] || ""}${money(order.rate)}`}
                  </span>
                </div>

                {txHash && (
                  <div className="flex justify-between text-[10px] border-t border-white/[0.04] pt-2 mt-2">
                    <span className="text-gray-600">Tx Hash</span>
                    <span className="font-mono text-gray-500 select-all">{shorten(txHash, 8, 8)}</span>
                  </div>
                )}
              </div>

              {txHash && (
                <div className="pt-2">
                  <a
                    href={getExplorerUrl(order.asset, txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/15 rounded-lg px-3 py-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on Explorer
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
