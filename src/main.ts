import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { validateEnv } from './config/validate-env.js';
import { setupOpenApi } from './openapi/setup-openapi.js';

async function bootstrap() {
  // Antes de criar a app: com configuração inválida a porta nem chega a abrir.
  const envErrors = validateEnv(process.env);
  if (envErrors.length > 0) {
    console.error('Configuração inválida:');
    for (const error of envErrors) console.error(`- ${error}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  // SIGTERM/SIGINT (ex.: o Railway parando o container) fecham o servidor
  // HTTP e rodam os onModuleDestroy, que desconectam o Prisma. Com
  // useProcessExit o processo sai com código 0 em vez de se matar com o sinal.
  app.enableShutdownHooks(undefined, { useProcessExit: true });
  setupOpenApi(app);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
