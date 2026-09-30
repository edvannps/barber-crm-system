import { defineConfig } from 'prisma/config';

// As variáveis ficam no .env da raiz do monorepo.
try {
  process.loadEnvFile('../../.env');
} catch {
  // Em CI/produção as variáveis vêm do ambiente.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
