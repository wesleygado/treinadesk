# Tasks

## 1. Testes (gerados a partir dos cenários e commitados antes da implementação)

- [x] 1.1 Unitário `src/config/validate-env.spec.ts` — "Variáveis obrigatórias conferidas na subida", "Variáveis opcionais" e "Mensagem sem segredos" (decisão 1): `DATABASE_URL` ausente/vazia → erro citando `DATABASE_URL`; `JWT_ACCESS_SECRET` ausente e com 20 caracteres → erro; 32 caracteres → sem erro; `REFRESH_TOKEN_TTL_DAYS` `0`, `-1`, `1.5`, `abc` → erro; ausente → sem erro; `PORT` `abc`, `0`, `70000` → erro; ausente e `8080` → sem erro; com `DATABASE_URL` ausente e `JWT_ACCESS_SECRET='curto'` retorna erros dos dois nomes e nenhuma string contém `curto`; env completo válido → lista vazia
- [x] 1.2 Unitário `src/health/health.controller.spec.ts` — "Health check público" (decisão 2): com `PrismaService` mockado resolvendo `$queryRaw`, retorna `{ status: 'ok' }`; com `$queryRaw` rejeitando `new Error('connect ECONNREFUSED postgresql://user:segredo@host')`, lança `ServiceUnavailableException` cuja resposta não contém `segredo`, `postgresql://` nem `ECONNREFUSED`
- [x] 1.3 E2e `test/health.e2e-spec.ts` (app montada como em `test/app.e2e-spec.ts`, sem apagar tabelas) — `GET /health` sem token → `200` e corpo exatamente `{ status: 'ok' }`; com `Authorization: Bearer token-invalido` → `200`; `GET /` sem token continua `401`
- [x] 1.4 Atualizar `test/docs.e2e-spec.ts` — "Documento OpenAPI público" e "Autenticação descrita" modificados: incluir `GET /health` na lista exata de operações (20) e na lista de operações públicas sem `security` bearer
- [x] 1.5 Rodar `npm test -- validate-env health` e `npm run test:e2e -- health docs`; verificar que falham pelos motivos esperados (módulos inexistentes / rota ausente) e que as demais suítes passam; commitar só os testes com `test(service-runtime): testes dos cenários da change 007`

## 2. Validação de env e encerramento (sem alterar arquivos de teste)

- [x] 2.1 Criar `src/config/validate-env.ts` com `validateEnv(env): string[]` (decisão 1); verificar que `npm test -- validate-env` passa
- [x] 2.2 Em `src/main.ts`: chamar `validateEnv(process.env)` antes do `NestFactory.create`, imprimir um erro por linha e `process.exit(1)`; `app.enableShutdownHooks(undefined, { useProcessExit: true })`; `bootstrap().catch(...)` com `process.exit(1)` (decisão 3); verificar com `npx tsc --noEmit`
- [x] 2.3 Verificar manualmente após `npm run build`: `DATABASE_URL= node dist/main.js` e `JWT_ACCESS_SECRET=curto node dist/main.js` saem com código ≠ 0, mensagem cita a variável e não contém o valor, e a porta não abre; com `.env` válido, a API sobe e um `SIGTERM` (emitido no próprio processo no Windows, decisão 3) desconecta o Prisma e termina com código 0; subir duas instâncias na mesma `PORT` faz a segunda sair com código 1

## 3. Health check (sem alterar arquivos de teste)

- [x] 3.1 Criar `src/openapi/responses/health.response.ts`, `src/health/health.controller.ts` (`@Public()`, `$queryRaw\`SELECT 1\``, `ServiceUnavailableException` com mensagem fixa, `@ApiTags('health')`, `@ApiOperation`, `@ApiOkResponse({ type: HealthResponse })`, `@ApiServiceUnavailableResponse({ type: ErrorResponse })`) e `src/health/health.module.ts`; importar no `AppModule`; verificar que `npm test -- health` e `npm run test:e2e -- health docs` passam
- [x] 3.2 Acrescentar `GET /health` em `docs/integracao-frontend.md` (onde o guia lista rotas públicas) e no `CLAUDE.md` (lista de rotas `@Public()`: `POST /users`, `POST /auth/login`, `POST /auth/refresh` e `GET /health`; validação de env no `main.ts` em `src/config/validate-env.ts`); verificar o diff dos arquivos

## 4. Build e configuração do Railway

- [x] 4.1 `package.json`: `build` → `prisma generate && nest build`, `start:prod` → `node dist/main.js`, remover `deploy` (decisão 4); verificar num clone limpo (`git clone . <scratch>/clone && cd <scratch>/clone && npm ci && cp <.env> . && npm run build`) que o build termina e gera `dist/main.js`
- [x] 4.2 Criar `railway.json` na raiz conforme a decisão 5; verificar que é JSON válido e que `preDeployCommand`, `startCommand` e `healthcheckPath` batem com os scripts e a rota
- [x] 4.3 Atualizar `.env.example`: mínimo de 32 caracteres no comentário de `JWT_ACCESS_SECRET` e `NODE_ENV` comentado com o aviso de que em produção MUST ser `production` (decisão 6); verificar que `validateEnv` aceita o arquivo copiado para `.env` (com o segredo de exemplo substituído por um gerado)
- [x] 4.4 README: seção "Deploy no Railway" com os passos do Migration Plan do design, a tabela de variáveis da decisão 7 (incluindo `DATABASE_URL=${{Postgres.DATABASE_URL}}` e o aviso sobre `NODE_ENV=production` e usuários de teste) e o que o pre-deploy faz; atualizar no `CLAUDE.md` os comandos (`build` gera o client) e mencionar `railway.json`; verificar que cada comando e caminho citado existe

## 5. Verificação

- [x] 5.1 Simular produção localmente: `npm run build`, `npx prisma migrate deploy && npm run seed` com `NODE_ENV=production` (saída `NODE_ENV=production: dados de teste ignorados`), `node dist/main.js`, `GET /health` → `200`, `GET /docs` → `200`, `GET /docs-json` lista `/health`
- [x] 5.2 Executar `npm run lint` e verificar que não há erros
- [x] 5.3 Executar `npm test`, `npx tsc --noEmit` e `npm run test:e2e`; verificar que tudo passa sem falhas
- [x] 5.4 Corrigir os testes com o client do Prisma regerado em ESM (design 4.1): `test/prisma-esm-transformer.cjs` como transformer de `jest.config.ts` e `test/jest-e2e.json`; verificar que `npm test` e `npm run test:e2e` passam com o client recém-gerado por `npm run build`

## 6. Dados de desenvolvimento

- [x] 6.1 Depois da verificação (os e2e apagam o banco), conferir que `prisma/dev-data.ts` não precisa de novas entidades (a change não cria dados de domínio); rodar `npm run seed` sem `NODE_ENV=production` e verificar que termina sem erro e restaura os usuários de teste

## Workflow follow-up

- Primeiro deploy no Railway (Migration Plan do design): criar Postgres e serviço, definir as variáveis, conferir nos logs do pre-deploy as migrations e `Administrador disponível`, confirmar que `prisma`/`tsx` estavam disponíveis (senão mover para `dependencies`), `GET /health` → 200 no domínio gerado.
- Arquivar a change com `/opsx:archive` após a revisão.
