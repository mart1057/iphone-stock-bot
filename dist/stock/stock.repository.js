import { Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../database/prisma.js';
export class StockRepository {
    db;
    constructor(db = defaultPrisma) {
        this.db = db;
    }
    async upsertProduct(model) {
        const product = await this.db.product.upsert({
            where: { model },
            create: { model },
            update: {},
            select: { id: true },
        });
        return product.id;
    }
    async upsertVariants(productId, variants) {
        const ids = new Map();
        for (const variant of variants) {
            const row = await this.db.productVariant.upsert({
                where: { partNumber: variant.partNumber },
                create: {
                    productId,
                    partNumber: variant.partNumber,
                    basePart: variant.basePart,
                    color: variant.color,
                    colorTh: variant.colorTh,
                    storage: variant.storage,
                    priceTHB: variant.priceTHB === null ? null : new Prisma.Decimal(variant.priceTHB),
                },
                update: {
                    productId,
                    basePart: variant.basePart,
                    color: variant.color,
                    colorTh: variant.colorTh,
                    storage: variant.storage,
                    priceTHB: variant.priceTHB === null ? null : new Prisma.Decimal(variant.priceTHB),
                },
                select: { id: true },
            });
            ids.set(variant.partNumber, row.id);
        }
        return ids;
    }
    async upsertStores(stores) {
        const ids = new Map();
        for (const store of stores) {
            const row = await this.db.store.upsert({
                where: { code: store.code },
                create: {
                    code: store.code,
                    name: store.name,
                    rawName: store.rawName,
                    city: store.city ?? null,
                    province: store.province ?? null,
                    address: store.address ?? null,
                    country: store.country,
                    latitude: store.latitude ?? null,
                    longitude: store.longitude ?? null,
                    storeUrl: store.storeUrl ?? null,
                },
                update: {
                    name: store.name,
                    rawName: store.rawName,
                    city: store.city ?? null,
                    province: store.province ?? null,
                    address: store.address ?? null,
                    country: store.country,
                    latitude: store.latitude ?? null,
                    longitude: store.longitude ?? null,
                    storeUrl: store.storeUrl ?? null,
                },
                select: { id: true },
            });
            ids.set(store.code, row.id);
        }
        return ids;
    }
    /// Loads the persisted baseline. This is what makes restarts safe: state
    /// lives in PostgreSQL, never only in memory.
    async loadPreviousStates() {
        const rows = await this.db.stock.findMany({
            select: {
                id: true,
                available: true,
                status: true,
                variant: { select: { partNumber: true } },
                store: { select: { code: true } },
                variantId: true,
                storeId: true,
            },
        });
        return new Map(rows.map((row) => [
            stockKey(row.variant.partNumber, row.store.code),
            {
                id: row.id,
                variantId: row.variantId,
                storeId: row.storeId,
                available: row.available,
                status: row.status,
            },
        ]));
    }
    async countStocks() {
        return this.db.stock.count();
    }
    /// Creates the (variant x store) row on first sight and returns its state.
    async ensureStock(variantId, storeId, current) {
        const existing = await this.db.stock.findUnique({
            where: { variantId_storeId: { variantId, storeId } },
            select: { id: true, available: true, status: true },
        });
        if (existing) {
            return {
                id: existing.id,
                previous: { available: existing.available, status: existing.status },
            };
        }
        const created = await this.db.stock.create({
            data: {
                variantId,
                storeId,
                available: current.status === 'AVAILABLE',
                status: current.status,
                lastCheckedAt: current.checkedAt,
                lastAvailableAt: current.status === 'AVAILABLE' ? current.checkedAt : null,
            },
            select: { id: true },
        });
        return { id: created.id, previous: null };
    }
    async persist(input) {
        const data = {
            status: input.status,
            lastCheckedAt: input.checkedAt,
        };
        if (input.updateAvailable) {
            data.available = input.available;
            if (input.available)
                data.lastAvailableAt = input.checkedAt;
        }
        await this.db.$transaction(async (tx) => {
            await tx.stock.update({ where: { id: input.stockId }, data });
            if (input.recordHistory) {
                await tx.stockHistory.create({
                    data: {
                        stockId: input.stockId,
                        available: input.updateAvailable ? input.available : null,
                        status: input.status,
                        checkedAt: input.checkedAt,
                    },
                });
            }
        });
    }
    async logNotification(entry) {
        await this.db.notificationLog.create({
            data: {
                stockId: entry.stockId,
                previousStatus: entry.previousStatus,
                currentStatus: entry.currentStatus,
                messageId: entry.messageId,
                success: entry.success,
                error: entry.error ?? null,
            },
        });
    }
    // -- Cooperative lock (multi-instance safety) -----------------------------
    /// Atomically grabs `name` unless a non-expired lock is already held.
    async acquireLock(name, owner, ttlSeconds) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
        const [taken] = await this.db.$queryRaw(Prisma.sql `
      INSERT INTO job_locks (name, owner, locked_at, expires_at)
      VALUES (${name}, ${owner}, ${now}, ${expiresAt})
      ON CONFLICT (name) DO UPDATE
        SET owner = EXCLUDED.owner,
            locked_at = EXCLUDED.locked_at,
            expires_at = EXCLUDED.expires_at
        WHERE job_locks.expires_at < ${now}
      RETURNING name
    `);
        return taken !== undefined;
    }
    async releaseLock(name, owner) {
        await this.db.jobLock.deleteMany({ where: { name, owner } });
    }
}
export const stockKey = (partNumber, storeCode) => `${partNumber}::${storeCode ?? 'unknown-store'}`;
export const stockRepository = new StockRepository();
//# sourceMappingURL=stock.repository.js.map