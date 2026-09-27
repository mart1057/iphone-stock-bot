import { env } from '../config/env.js';
import { chunk, mapWithLimit } from '../utils/concurrency.js';
import { logger } from '../utils/logger.js';
import { appleCatalog } from './apple.catalog.js';
import { appleClient } from './apple.client.js';
import { parsePickupMessage } from './apple.parser.js';
import { mergeStores } from './apple.store.js';
import { isRateLimitError } from './apple.types.js';
/**
 * Collects availability for every tracked variant across every Apple Store TH.
 *
 * Apple accepts all 16 part numbers in ONE pickup-message call, so a full
 * sweep is normally a single HTTP request (~0.4s). Chunking + a concurrency
 * cap exist for the day the lineup grows or Apple tightens the limit.
 */
export class AppleAvailabilityCollector {
    client;
    catalog;
    constructor(client = appleClient, catalog = appleCatalog) {
        this.client = client;
        this.catalog = catalog;
    }
    async collect() {
        const checkedAt = new Date();
        const variants = await this.catalog.getVariants();
        const variantMap = new Map(variants.map((variant) => [variant.partNumber, variant]));
        const partChunks = chunk(variants.map((variant) => variant.partNumber), env.APPLE_MAX_PARTS_PER_REQUEST);
        // One job per (postcode x part-chunk). With the current TH lineup that is
        // exactly one job.
        const jobs = env.applePostalCodes.flatMap((postalCode) => partChunks.map((parts) => ({ postalCode, parts })));
        logger.debug(`Availability sweep: ${jobs.length} request(s)`, `variants=${variants.length} postcodes=${env.applePostalCodes.length} concurrency=${env.MAX_CONCURRENT_REQUESTS}`);
        const results = await mapWithLimit(jobs, env.MAX_CONCURRENT_REQUESTS, async (job) => {
            const response = await this.client.getPickupMessage(job.parts, job.postalCode);
            return parsePickupMessage(response, variantMap, checkedAt);
        });
        const stocks = [];
        const stores = [];
        const errors = [];
        const seen = new Set();
        let rateLimited = false;
        for (const result of results) {
            if ('error' in result) {
                const message = result.error instanceof Error ? result.error.message : String(result.error);
                errors.push(`${result.item.postalCode}: ${message}`);
                if (isRateLimitError(result.error))
                    rateLimited = true;
                continue;
            }
            stores.push(...result.value.stores);
            for (const stock of result.value.stocks) {
                // The same (part, store) can appear in several postcode sweeps.
                const key = `${stock.partNumber}::${stock.storeCode ?? stock.storeName}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                stocks.push(stock);
            }
        }
        return { checkedAt, stocks, stores: mergeStores(stores), variants, errors, rateLimited };
    }
}
export const appleAvailabilityCollector = new AppleAvailabilityCollector();
//# sourceMappingURL=apple.availability.js.map