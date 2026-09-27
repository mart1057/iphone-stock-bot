import { env } from '../config/env.js';
const ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
const COLOR = {
    debug: '\x1b[90m',
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
};
const RESET = '\x1b[0m';
const useColor = process.stdout.isTTY === true && env.NODE_ENV !== 'production';
const clock = (date = new Date()) => date.toLocaleTimeString('en-GB', { hour12: false, timeZone: process.env.TZ ?? 'Asia/Bangkok' });
const formatMeta = (meta) => {
    if (meta === undefined)
        return '';
    if (meta instanceof Error)
        return ` ${meta.name}: ${meta.message}`;
    if (typeof meta === 'string')
        return ` ${meta}`;
    try {
        return ` ${JSON.stringify(meta)}`;
    }
    catch {
        return ' [unserializable meta]';
    }
};
const emit = (level, message, meta) => {
    if (ORDER[level] < ORDER[env.LOG_LEVEL])
        return;
    const tag = level.toUpperCase().padEnd(5);
    const head = `[${clock()}] ${tag}`;
    const line = `${useColor ? COLOR[level] + head + RESET : head} ${message}${formatMeta(meta)}`;
    if (level === 'error')
        console.error(line);
    else if (level === 'warn')
        console.warn(line);
    else
        console.log(line);
};
export const logger = {
    debug: (message, meta) => emit('debug', message, meta),
    info: (message, meta) => emit('info', message, meta),
    warn: (message, meta) => emit('warn', message, meta),
    error: (message, meta) => emit('error', message, meta),
    /// Plain stdout line, used for the startup banner.
    raw: (message) => console.log(message),
};
//# sourceMappingURL=logger.js.map