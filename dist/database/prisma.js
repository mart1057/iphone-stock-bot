import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
export const prisma = new PrismaClient({
    log: env.LOG_LEVEL === 'debug' ? ['warn', 'error', 'query'] : ['warn', 'error'],
});
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
//# sourceMappingURL=prisma.js.map