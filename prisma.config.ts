import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({
    datasources: {
        url: process.env.DATABASE_URL,
    }
});