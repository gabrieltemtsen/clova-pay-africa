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

class MemoryLedger {
  private payouts = new Map<string, PayoutRecord>();
  private providers = new Map<string, LiquidityProvider>();

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
}

class PostgresLedger {
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
      create table if not exists liquidity_providers (
        provider_id text primary key,
        name text not null,
        currency text not null,
        balance_kobo bigint not null,
        fee_bps int not null,
        created_at bigint not null,
        updated_at bigint not null
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
}

const databaseUrl = process.env.DATABASE_URL;
export const ledger = databaseUrl ? new PostgresLedger(databaseUrl) : new MemoryLedger();
