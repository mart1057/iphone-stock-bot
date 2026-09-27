import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { appleClient } from './apple.client.js';
import { parseCatalog, storageRank } from './apple.parser.js';
/**
 * Discovers the tracked variants (part numbers) from Apple's own buy-flow page
 * instead of hard-coding them, so a lineup change is picked up automatically.
 * Cached for APPLE_CATALOG_TTL_MINUTES - part numbers change far less often
 * than availability does.
 */
export class AppleCatalog {
    client;
    variants = [];
    loadedAt = null;
    inflight = null;
    constructor(client = appleClient) {
        this.client = client;
    }
    isStale() {
        if (this.loadedAt === null)
            return true;
        return Date.now() - this.loadedAt > env.APPLE_CATALOG_TTL_MINUTES * 60_000;
    }
    async getVariants(force = false) {
        if (!force && !this.isStale() && this.variants.length > 0)
            return this.variants;
        // Collapse concurrent refreshes into a single fetch.
        this.inflight ??= this.refresh().finally(() => {
            this.inflight = null;
        });
        return this.inflight;
    }
    async getVariantMap(force = false) {
        const variants = await this.getVariants(force);
        return new Map(variants.map((variant) => [variant.partNumber, variant]));
    }
    async refresh() {
        const html = await this.client.getProductPageHtml();
        const variants = parseCatalog(html, env.APPLE_MODEL_FILTER);
        if (variants.length === 0) {
            // Keep the previous catalogue rather than blanking the monitor.
            logger.error('Apple catalogue parse returned 0 variants - keeping previous catalogue', `model="${env.APPLE_MODEL_FILTER}" url=${env.APPLE_PRODUCT_URL}`);
            if (this.variants.length > 0)
                return this.variants;
            throw new Error(`No variants found for "${env.APPLE_MODEL_FILTER}" on ${env.APPLE_PRODUCT_URL}`);
        }
        this.variants = variants.sort((a, b) => storageRank(a.storage) - storageRank(b.storage) || a.color.localeCompare(b.color));
        this.loadedAt = Date.now();
        logger.info(`Catalogue loaded: ${variants.length} variants`, `colors=${[...new Set(variants.map((v) => v.color))].join('/')} storage=${[...new Set(variants.map((v) => v.storage))].join('/')}`);
        return this.variants;
    }
}
export const appleCatalog = new AppleCatalog();
//# sourceMappingURL=apple.catalog.js.map