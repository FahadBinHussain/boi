import { PrismaClient, Prisma } from "../generated/prisma";

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Make sure DATABASE_URL is properly used as a direct string
const prismaOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === "development" 
    ? ['query', 'error', 'warn'] as Prisma.LogLevel[] 
    : ['error'] as Prisma.LogLevel[],
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma; 