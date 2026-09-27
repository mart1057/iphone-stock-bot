/**
 * Apple Store Thailand has no public store-list JSON endpoint (verified: the
 * retail store list page is client-rendered and /rsp-web/store-list 404s), so
 * stores are discovered from the pickup-message response itself, which carries
 * the full store record (code, name, address, lat/lng).
 *
 * Nothing here is hard-coded: a new Apple Store simply shows up in a later
 * response and gets upserted.
 */
export class StoreDirectory {
    byCode = new Map();
    add(stores) {
        for (const store of stores)
            this.byCode.set(store.code, store);
    }
    get(code) {
        return this.byCode.get(code);
    }
    all() {
        return [...this.byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
    }
    get size() {
        return this.byCode.size;
    }
}
/// Merges stores discovered across several postcode sweeps, keeping the record
/// with the most populated fields.
export const mergeStores = (stores) => {
    const directory = new StoreDirectory();
    const score = (store) => Object.values(store).filter((value) => value !== undefined && value !== null).length;
    for (const store of stores) {
        const existing = directory.get(store.code);
        if (!existing || score(store) > score(existing))
            directory.add([store]);
    }
    return directory.all();
};
//# sourceMappingURL=apple.store.js.map