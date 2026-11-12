# Design

## Context

Motivação em `proposal.md`. Estado atual relevante:

- `src/main.ts` cria a app, chama `setupOpenApi` e `app.listen(process.env.PORT ?? 3000)`; sem `enableShutdownHooks()` e sem `.catch` no `bootstrap()`.
- `PrismaService` (`src/prisma/prisma.service.ts`) já tem `onModuleDestroy` com `$disconnect`, mas ele só roda no `app.close()` ou com os shutdown hooks ligados.
- Checagens de env espalhadas: `jwtOptions()` em `src/auth/auth.module.ts` (só presença do segredo) e `refreshTokenTtlMs()` em `src/auth/auth.service.ts` (lazy, no primeiro uso). `DATABASE_URL` não é checada.
- `JwtAuthGuard` é `APP_GUARD`; rota aberta precisa de `@Public()`. `@Public()` ignora o header `Authorization`, então token inválido não gera 401.
- `src/generated` está no `.gitignore`; `build` = `nest build` sem `prisma generate`. `prisma7.config.ts` usa `env("DATABASE_URL")`, que falha se a variável não existir quando o CLI carrega a config.
- `prisma`, `tsx` e `@nestjs/cli` são devDependencies; o seed (`prisma/seed.ts`) roda via `tsx` e importa `.ts` de `src/` e `prisma/dev-data.ts`.
- e2e sobem a app via `Test.createTestingModule({ imports: [AppModule] })`, sem passar pelo `main.ts`.

## Goals / Non-Goals

**Goals:**
- Deploy no Railway reproduzível a partir do repositório, sem passos manuais além de definir variáveis.
- Falhar cedo e de forma legível com configuração errada.

**Non-Goals:**
- Liveness vs. readiness separados (um único `/health` basta para o Railway).
- Biblioteca de configuração (`@nestjs/config`, `@nestjs/terminus`, zod/joi).
- Logs estruturados.

## Decisions

### 1. Validação de env em função pura chamada no `main.ts`
`src/config/validate-env.ts` exporta `validateEnv(env: NodeJS.ProcessEnv): string[]` (lista de erros no formato `NOME: motivo`) — pura e testável por unitário. O `main.ts` chama antes do `NestFactory.create`; se houver erros, faz `console.error` de uma linha por variável e `process.exit(1)`. Nenhum valor entra na mensagem.
- Mínimo de 32 caracteres para `JWT_ACCESS_SECRET` (256 bits em ASCII, coerente com HS256). O `.env` local atual já atende.
- `PORT`: inteiro 1–65535; `REFRESH_TOKEN_TTL_DAYS`: inteiro positivo. `JWT_ACCESS_EXPIRES_IN` fica sem validação (formato do `ms` é amplo; erro aparece no `sign`).
- As checagens existentes em `auth.module.ts`/`auth.service.ts` permanecem como defesa (e porque os e2e não passam pelo `main.ts`).
- **Alternativa descartada**: `@nestjs/config` com `validationSchema` — nova dependência e reestruturação da leitura de env (o projeto usa `process.env` direto, ver CLAUDE.md), para ganho pequeno.
- **Alternativa descartada**: validar dentro do `AppModule` — os e2e passariam a exigir o env completo e a falha viraria exceção de DI, menos legível.

### 2. `GET /health` em `HealthController` próprio
`src/health/health.controller.ts` + `HealthModule` importado no `AppModule`. Rota `@Public()` executa `this.prisma.$queryRaw\`SELECT 1\``; em erro lança `ServiceUnavailableException` com mensagem fixa (`'Banco de dados indisponível'`), sem repassar o erro. Resposta `{ status: 'ok' }`.
- Documentação: `@ApiOperation` + `@ApiOkResponse` com nova classe `src/openapi/responses/health.response.ts` e `@ApiServiceUnavailableResponse({ type: ErrorResponse })`. Sem `@ApiAuth` (rota pública), seguindo o padrão do `auth.controller.ts`.
- Mantém `GET /` como está (protegida) — mudar quebraria `api-docs` e o e2e existente.
- **Alternativa descartada**: `@nestjs/terminus` — dependência extra para uma consulta.
- **Alternativa descartada**: health sem tocar no banco — o Railway colocaria no ar uma instância sem conectividade com o Postgres.
- Teste do `503`: unitário do controller com `PrismaService` mockado lançando erro (derrubar o banco no e2e não é viável). `200` e "token inválido" no e2e.

### 3. Encerramento: `enableShutdownHooks()` + `.catch` no bootstrap
`app.enableShutdownHooks(undefined, { useProcessExit: true })` no `main.ts` faz o Nest tratar `SIGTERM`/`SIGINT`: fecha o servidor HTTP e roda `onModuleDestroy` (desconecta o Prisma). Sem `useProcessExit`, o Nest reenvia o sinal ao próprio processo depois do shutdown, que então termina por sinal e não com código `0` como a spec exige. `bootstrap().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); })` cobre porta ocupada e falha de conexão.
- Start command é `node dist/main.js` direto (não via `npm run`), para o sinal chegar ao processo Node.
- Verificação: manual/local. No Windows, sinal enviado por outro processo encerra o Node à força, então o teste local emite `SIGTERM` dentro do próprio processo (`process.emit`) e confere `$disconnect` e o código de saída; o comportamento real é conferido no primeiro deploy (Linux).

### 4. Build e scripts
- `"build": "prisma generate && nest build"` — o `nest build` apaga `dist`, não `src/generated`; ordem garante client presente.
- `"start:prod": "node dist/main.js"`; remove `"deploy": "nest deploy"`.
- **Alternativa descartada**: `postinstall: prisma generate` — roda também em todo `npm install` local e em CI sem `DATABASE_URL`, quebrando por causa do `env()` do `prisma7.config.ts`.

### 4.1 Client do Prisma regerado e os testes em CommonJS
Com o `prisma generate` no build, o client é sempre regerado. Como o pacote é ESM, o client sai com `import.meta.url`, que não existe no CommonJS em que o ts-jest compila os testes (`exports is not defined`); um client antigo, gerado antes da conversão para ESM, escondia o problema, que já existia em qualquer clone novo. `test/prisma-esm-transformer.cjs` envolve o ts-jest e, só nos arquivos de `src/generated`, troca `import.meta.url` por `pathToFileURL(__filename).href`; é o transformer de `jest.config.ts` e `test/jest-e2e.json`. O build de produção não passa por ele.
- **Alternativa descartada**: `ts-jest-mock-import-meta` — dependência nova para uma linha.
- **Alternativa descartada**: `moduleFormat = "cjs"` no generator — o runtime é ESM, onde `__dirname` não existe.

### 5. `railway.json` (config as code)
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "RAILPACK", "buildCommand": "npm run build" },
  "deploy": {
    "preDeployCommand": ["npx prisma migrate deploy && npm run seed"],
    "startCommand": "node dist/main.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE"
  }
}
```
- Pre-deploy roda migrations e depois o seed. O seed é idempotente (`upsert` sem `update`) e, com `NODE_ENV=production`, só garante o ADMIN. Rodar a cada deploy é seguro e dispensa passo manual.
- Depende de devDependencies na imagem final (`prisma`, `tsx`). O Railpack mantém devDependencies por padrão (só remove com `RAILPACK_PRUNE_DEPS`); a tarefa de verificação confere isso no primeiro deploy. **Alternativa** se não estiverem: mover `prisma` e `tsx` para `dependencies`.
- **Alternativa descartada**: migrate no start command — atrasaria o boot e rodaria em cada réplica.

### 6. Proteção contra dados de teste em produção
`NODE_ENV=production` vira variável obrigatória documentada para o Railway (README e `.env.example`). Não se adiciona trava no código do seed: o comportamento atual já é correto com a variável definida, e a validação de env da API não alcança o seed. A seção do README destaca o risco (usuários com senha pública).

### 7. Variáveis no Railway
`DATABASE_URL=${{Postgres.DATABASE_URL}}` (referência à rede privada, sem SSL), `JWT_ACCESS_SECRET` gerado, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NODE_ENV=production`; opcionais `JWT_ACCESS_EXPIRES_IN`, `REFRESH_TOKEN_TTL_DAYS`. `PORT` não é definida (o Railway injeta). As variáveis de serviço ficam disponíveis no build, o que satisfaz o `env("DATABASE_URL")` do `prisma generate`.

## Risks / Trade-offs

- [DevDependencies removidas na imagem] → pre-deploy falha com `prisma: not found`; mitigação: verificar no primeiro deploy e mover `prisma`/`tsx` para `dependencies` se preciso.
- [`NODE_ENV` esquecido no Railway] → seed cria usuários de teste com senha pública; mitigação: README em destaque e checklist de variáveis na tarefa de deploy.
- [Health check consulta o banco a cada chamada] → custo desprezível (`SELECT 1`); aceitável.
- [Segredo local com menos de 32 caracteres em máquinas de alunos] → `start:dev` passa a recusar subir; mitigação: mensagem clara e comando de geração já presente no `.env.example`.
- [Railway sem healthcheck durante o deploy inicial lento] → `healthcheckTimeout` 60s cobre a conexão inicial do Prisma.

## Migration Plan

1. Mergear a change; criar no Railway o Postgres e o serviço da API ligado ao repositório (o `railway.json` é lido automaticamente).
2. Definir as variáveis da Decisão 7 antes do primeiro deploy.
3. Primeiro deploy: conferir nos logs do pre-deploy as migrations aplicadas e a linha `Administrador disponível`, depois `GET /health` → 200 e `GET /docs`.
4. Gerar domínio público e configurar `API_URL` no projeto Next da Vercel (fora do escopo do repositório).
5. Rollback: redeploy da versão anterior pelo Railway; as migrations não mudam nesta change, então não há rollback de schema.
