import pg from "pg";

export type PayoutRecord = {
  payoutId: string;
  quoteId: string;
  amountKobo: number;
  currency: "NGN";
  recipientCode: string;
  reason?: string;
  status: "processing" | "settled" | "failed";
  provider: "paystack";
  transferCode?: string;
  transferRef?: string;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
};

export type LiquidityProvider = {
  providerId: string;
  name: string;
  currency: "NGN";
  balanceKobo: number;
  feeBps: number;
  createdAt: number;
  updatedAt: number;
};

export type SettlementRecord = {
  settlementId: string;
  quoteId: string;
  asset: "cUSD_CELO" | "USDC_BASE" | "USDCX_STACKS";
  amountCrypto: string;
  txHash: string;
  confirmations: number;
  source: "watcher" | "manual";
  status: "credited";
  createdAt: number;
  updatedAt: number;
};

export type LedgerEntry = {
  entryId: string;
  quoteId: string;
  payoutId?: string;
  providerId?: string;
  kind: "platform_fee" | "lp_fee";
  currency: "NGN";
  amountKobo: number;
  memo?: string;
  createdAt: number;
};

type Ledger = {
  init(): Promise<void>;
  putPayout(p: PayoutRecord): Promise<void>;
  getPayout(payoutId: string): Promise<PayoutRecord | undefined>;
  updatePayout(payoutId: string, patch: Partial<PayoutRecord>): Promise<PayoutRecord | undefined>;
  findPayoutByTransferRef(transferRef: string): Promise<PayoutRecord | undefined>;
  findPayoutByQuoteId(quoteId: string): Promise<PayoutRecord | undefined>;
  listPayouts(): Promise<PayoutRecord[]>;

  upsertProvider(p: LiquidityProvider): Promise<void>;
  getProvider(providerId: string): Promise<LiquidityProvider | undefined>;
  listProviders(): Promise<LiquidityProvider[]>;
  adjustProviderBalance(providerId: string, deltaKobo: number): Promise<LiquidityProvider | undefined>;

  createSettlementIfAbsent(s: SettlementRecord): Promise<{ settlement: SettlementRecord; inserted: boolean }>;
  listSettlements(limit?: number): Promise<SettlementRecord[]>;

  addLedgerEntry(e: LedgerEntry): Promise<void>;
  listLedgerEntries(limit?: number): Promise<LedgerEntry[]>;
};

class MemoryLedger implements Ledger {
  private payouts = new Map<string, PayoutRecord>();
  private providers = new Map<string, LiquidityProvider>();
  private settlements = new Map<string, SettlementRecord>(); // key: txHash
  private entries: LedgerEntry[] = [];

  async init() {}

  async putPayout(p: PayoutRecord) { this.payouts.set(p.payoutId, p); }
  async getPayout(payoutId: string) { return this.payouts.get(payoutId); }
  async updatePayout(payoutId: string, patch: Partial<PayoutRecord>) {
    const p = this.payouts.get(payoutId); if (!p) return undefined;
    const next = { ...p, ...patch, updatedAt: Date.now() };
    this.payouts.set(payoutId, next); return next;
  }
  async findPayoutByTransferRef(transferRef: string) {
    return Array.from(this.payouts.values()).find((p) => p.transferRef === transferRef || p.transferCode === transferRef);
  }
  async findPayoutByQuoteId(quoteId: string) {
    return Array.from(this.payouts.values()).find((p) => p.quoteId === quoteId);
  }
  async listPayouts() { return Array.from(this.payouts.values()).sort((a, b) => b.createdAt - a.createdAt); }

  async upsertProvider(p: LiquidityProvider) { this.providers.set(p.providerId, p); }
  async getProvider(providerId: string) { return this.providers.get(providerId); }
  async listProviders() { return Array.from(this.providers.values()).sort((a, b) => b.createdAt - a.createdAt); }
  async adjustProviderBalance(providerId: string, deltaKobo: number) {
    const p = this.providers.get(providerId); if (!p) return undefined;
    const next = { ...p, balanceKobo: p.balanceKobo + deltaKobo, updatedAt: Date.now() };
    this.providers.set(providerId, next);
    return next;
  }

  async createSettlementIfAbsent(s: SettlementRecord) {
    const existing = this.settlements.get(s.txHash.toLowerCase());
    if (existing) return { settlement: existing, inserted: false };
    const normalized = { ...s, txHash: s.txHash.toLowerCase() };
    this.settlements.set(normalized.txHash, normalized);
    return { settlement: normalized, inserted: true };
  }
  async listSettlements(limit = 200) {
    return Array.from(this.settlements.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  async addLedgerEntry(e: LedgerEntry) { this.entries.unshift(e); }
  async listLedgerEntries(limit = 200) { return this.entries.slice(0, limit); }
}

class PostgresLedger implements Ledger {
  private pool: pg.Pool;
  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  }

  async init() {
    await this.pool.query(`
      create table if not exists payouts (
        payout_id text primary key,
        quote_id text not null,
        amount_kobo bigint not null,
        currency text not null,
        recipient_code text not null,
        reason text,
        status text not null,
        provider text not null,
        transfer_code text,
        transfer_ref text,
        failure_reason text,
        created_at bigint not null,
        updated_at bigint not null
      );
      create index if not exists idx_payout_quote_id on payouts(quote_id);

      create table if not exists liquidity_providers (
        provider_id text primary key,
        name text not null,
        currency text not null,
        balance_kobo bigint not null,
        fee_bps int not null,
        created_at bigint not null,
        updated_at bigint not null
      );

      create table if not exists settlements (
        settlement_id text primary key,
        quote_id text not null,
        asset text not null,
        amount_crypto text not null,
        tx_hash text not null unique,
        confirmations int not null,
        source text not null,
        status text not null,
        created_at bigint not null,
        updated_at bigint not null
      );

      create table if not exists ledger_entries (
        entry_id text primary key,
        quote_id text not null,
        payout_id text,
        provider_id text,
        kind text not null,
        currency text not null,
        amount_kobo bigint not null,
        memo text,
        created_at bigint not null
      );
    `);
  }

  rowToPayout(r: any): PayoutRecord {
    return {
      payoutId: r.payout_id, quoteId: r.quote_id, amountKobo: Number(r.amount_kobo), currency: r.currency,
      recipientCode: r.recipient_code, reason: r.reason || undefined, status: r.status, provider: r.provider,
      transferCode: r.transfer_code || undefined, transferRef: r.transfer_ref || undefined,
      failureReason: r.failure_reason || undefined, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
    };
  }

  rowToProvider(r: any): LiquidityProvider {
    return {
      providerId: r.provider_id, name: r.name, currency: r.currency,
      balanceKobo: Number(r.balance_kobo), feeBps: Number(r.fee_bps),
      createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
    };
  }

  rowToSettlement(r: any): SettlementRecord {
    return {
      settlementId: r.settlement_id,
      quoteId: r.quote_id,
      asset: r.asset,
      amountCrypto: r.amount_crypto,
      txHash: r.tx_hash,
      confirmations: Number(r.confirmations),
      source: r.source,
      status: r.status,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };
  }

  rowToEntry(r: any): LedgerEntry {
    return {
      entryId: r.entry_id,
      quoteId: r.quote_id,
      payoutId: r.payout_id || undefined,
      providerId: r.provider_id || undefined,
      kind: r.kind,
      currency: r.currency,
      amountKobo: Number(r.amount_kobo),
      memo: r.memo || undefined,
      createdAt: Number(r.created_at),
    };
  }

  async putPayout(p: PayoutRecord) {
    await this.pool.query(
      `insert into payouts (payout_id,quote_id,amount_kobo,currency,recipient_code,reason,status,provider,transfer_code,transfer_ref,failure_reason,created_at,updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (payout_id) do update set quote_id=excluded.quote_id, amount_kobo=excluded.amount_kobo, currency=excluded.currency,
       recipient_code=excluded.recipient_code, reason=excluded.reason, status=excluded.status, provider=excluded.provider,
       transfer_code=excluded.transfer_code, transfer_ref=excluded.transfer_ref, failure_reason=excluded.failure_reason, updated_at=excluded.updated_at`,
      [p.payoutId, p.quoteId, p.amountKobo, p.currency, p.recipientCode, p.reason || null, p.status, p.provider, p.transferCode || null, p.transferRef || null, p.failureReason || null, p.createdAt, p.updatedAt],
    );
  }
  async getPayout(payoutId: string) {
    const r = await this.pool.query(`select * from payouts where payout_id = $1`, [payoutId]);
    return r.rows[0] ? this.rowToPayout(r.rows[0]) : undefined;
  }
  async updatePayout(payoutId: string, patch: Partial<PayoutRecord>) {
    const current = await this.getPayout(payoutId); if (!current) return undefined;
    const next = { ...current, ...patch, updatedAt: Date.now() };
    await this.putPayout(next);
    return next;
  }
  async findPayoutByTransferRef(transferRef: string) {
    const r = await this.pool.query(`select * from payouts where transfer_ref = $1 or transfer_code = $1 limit 1`, [transferRef]);
    return r.rows[0] ? this.rowToPayout(r.rows[0]) : undefined;
  }
  async findPayoutByQuoteId(quoteId: string) {
    const r = await this.pool.query(`select * from payouts where quote_id = $1 order by created_at desc limit 1`, [quoteId]);
    return r.rows[0] ? this.rowToPayout(r.rows[0]) : undefined;
  }
  async listPayouts() {
    const r = await this.pool.query(`select * from payouts order by created_at desc limit 500`);
    return r.rows.map((x: any) => this.rowToPayout(x));
  }

  async upsertProvider(p: LiquidityProvider) {
    await this.pool.query(
      `insert into liquidity_providers (provider_id,name,currency,balance_kobo,fee_bps,created_at,updated_at)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (provider_id) do update set name=excluded.name,currency=excluded.currency,balance_kobo=excluded.balance_kobo,fee_bps=excluded.fee_bps,updated_at=excluded.updated_at`,
      [p.providerId, p.name, p.currency, p.balanceKobo, p.feeBps, p.createdAt, p.updatedAt],
    );
  }
  async getProvider(providerId: string) {
    const r = await this.pool.query(`select * from liquidity_providers where provider_id = $1`, [providerId]);
    return r.rows[0] ? this.rowToProvider(r.rows[0]) : undefined;
  }
  async listProviders() {
    const r = await this.pool.query(`select * from liquidity_providers order by created_at desc limit 500`);
    return r.rows.map((x: any) => this.rowToProvider(x));
  }
  async adjustProviderBalance(providerId: string, deltaKobo: number) {
    const p = await this.getProvider(providerId); if (!p) return undefined;
    const next = { ...p, balanceKobo: p.balanceKobo + deltaKobo, updatedAt: Date.now() };
    await this.upsertProvider(next);
    return next;
  }

  async createSettlementIfAbsent(s: SettlementRecord) {
    const normalizedTxHash = s.txHash.toLowerCase();
    const existing = await this.pool.query(`select * from settlements where tx_hash = $1 limit 1`, [normalizedTxHash]);
    if (existing.rows[0]) return { settlement: this.rowToSettlement(existing.rows[0]), inserted: false };

    const next = { ...s, txHash: normalizedTxHash };
    await this.pool.query(
      `insert into settlements (settlement_id,quote_id,asset,amount_crypto,tx_hash,confirmations,source,status,created_at,updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [next.settlementId, next.quoteId, next.asset, next.amountCrypto, next.txHash, next.confirmations, next.source, next.status, next.createdAt, next.updatedAt],
    );
    return { settlement: next, inserted: true };
  }

  async listSettlements(limit = 200) {
    const r = await this.pool.query(`select * from settlements order by created_at desc limit $1`, [limit]);
    return r.rows.map((x: any) => this.rowToSettlement(x));
  }

  async addLedgerEntry(e: LedgerEntry) {
    await this.pool.query(
      `insert into ledger_entries (entry_id,quote_id,payout_id,provider_id,kind,currency,amount_kobo,memo,created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [e.entryId, e.quoteId, e.payoutId || null, e.providerId || null, e.kind, e.currency, e.amountKobo, e.memo || null, e.createdAt],
    );
  }

  async listLedgerEntries(limit = 200) {
    const r = await this.pool.query(`select * from ledger_entries order by created_at desc limit $1`, [limit]);
    return r.rows.map((x: any) => this.rowToEntry(x));
  }
}

const databaseUrl = process.env.DATABASE_URL;
export const ledger: Ledger = databaseUrl ? new PostgresLedger(databaseUrl) : new MemoryLedger();
