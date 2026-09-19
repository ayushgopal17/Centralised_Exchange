import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL!;
const schema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
const adapter = new PrismaPg(databaseUrl, { schema });

const prisma = new PrismaClient({
  adapter,
});

export default prisma;