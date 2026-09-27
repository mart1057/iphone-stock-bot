import { z } from 'zod';
/**
 * Shapes below are modelled on the REAL responses observed from
 * Apple Store Thailand (verified 2026-09-18):
 *
 *   GET https://www.apple.com/th/shop/retail/pickup-message
 *       ?parts.0=MJXQ4ZP%2FA&parts.1=...&little=false&location=10330
 *
 * Everything is deliberately permissive (`.passthrough()`, optional fields):
 * this is an internal Apple API with no public contract, so an unexpected
 * shape must degrade to UNKNOWN rather than crash the bot.
 */
export const partAvailabilitySchema = z
    .object({
    partNumber: z.string().optional(),
    /// Observed values: "available" | "unavailable". Anything else -> UNKNOWN.
    pickupDisplay: z.string().optional(),
    pickupSearchQuote: z.string().optional(),
    storePickEligible: z.boolean().optional(),
    messageTypes: z
        .object({
        regular: z
            .object({
            basePartNumber: z.string().optional(),
            storePickupProductTitle: z.string().optional(),
            storePickupQuote: z.string().optional(),
        })
            .passthrough()
            .optional(),
    })
        .passthrough()
        .optional(),
})
    .passthrough();
export const storeAddressSchema = z
    .object({
    address: z.string().optional(),
    address2: z.string().optional(),
    address3: z.string().optional(),
    postalCode: z.string().optional(),
})
    .passthrough();
export const pickupStoreSchema = z
    .object({
    storeNumber: z.string(),
    storeName: z.string(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    address: storeAddressSchema.optional(),
    storelatitude: z.number().optional(),
    storelongitude: z.number().optional(),
    reservationUrl: z.string().optional(),
    partsAvailability: z.record(z.string(), partAvailabilitySchema).default({}),
})
    .passthrough();
export const pickupMessageResponseSchema = z
    .object({
    head: z
        .object({
        status: z.union([z.string(), z.number()]).optional(),
    })
        .passthrough()
        .optional(),
    body: z
        .object({
        stores: z.array(pickupStoreSchema).default([]),
        storesCount: z.string().optional(),
    })
        .passthrough()
        .default({ stores: [] }),
})
    .passthrough();
/**
 * Statuses that mean "Apple is pushing back", not "the data says unavailable".
 * 541 is the status Apple's edge returns for a request it refuses to serve.
 */
export const RATE_LIMIT_STATUSES = new Set([403, 429, 503, 541]);
export class AppleRequestError extends Error {
    status;
    retryable;
    constructor(message, status, retryable = true) {
        super(message);
        this.status = status;
        this.retryable = retryable;
        this.name = 'AppleRequestError';
    }
    get isRateLimit() {
        return this.status !== undefined && RATE_LIMIT_STATUSES.has(this.status);
    }
}
export const isRateLimitError = (error) => error instanceof AppleRequestError && error.isRateLimit;
//# sourceMappingURL=apple.types.js.map