# Proposal

## Why

A API vai ser publicada no Railway, com PostgreSQL gerenciado, e o frontend Next.js (na Vercel) vai chamá-la pelo servidor. Hoje ela não está pronta para isso: o build quebra num clone limpo (o client do Prisma em `src/generated` é ignorado pelo git e nenhum script o gera), não existe rota de health check (a única rota aberta além de auth é `/docs`, e `GET /` responde `401`), o SIGTERM do Railway encerra o processo sem desconectar do banco, as variáveis de ambiente só são conferidas parcialmente e tarde (o TTL do refresh token só no primeiro login), e nada roda as migrations nem cria o ADMIN inicial no deploy. Esta change fecha essas lacunas sem alterar nenhuma rota existente.

## What Changes

- Nova rota pública `GET /health`: responde `200` com `{ "status": "ok" }` quando o banco responde e `503` quando não, para o health check do Railway. Sem token, sem dados sensíveis, documentada no OpenAPI.
- Validação das variáveis de ambiente na subida, antes de aceitar conexões: `DATABASE_URL` obrigatória, `JWT_ACCESS_SECRET` obrigatória com no mínimo 32 caracteres, `REFRESH_TOKEN_TTL_DAYS` e `PORT` inteiros positivos quando definidas. Variável inválida encerra o processo com código diferente de zero e mensagem com o nome da variável, nunca com o valor.
- Encerramento gracioso: ao receber `SIGTERM`/`SIGINT`, a API para de aceitar conexões, conclui o encerramento dos módulos (incluindo desconectar do banco) e sai; falha na subida sai com código `1`.
- Build reprodutível: o script `build` passa a gerar o client do Prisma antes de compilar; `start:prod` aponta para `dist/main.js`; sai o script `deploy` (`nest deploy`), sobra de outra plataforma.
- `railway.json` na raiz: comandos de build e start, pre-deploy que aplica as migrations e garante o ADMIN inicial (seed idempotente, sem dados de teste com `NODE_ENV=production`) e health check em `/health`.
- README ganha a seção de deploy no Railway, com as variáveis exigidas; `.env.example` passa a indicar o tamanho mínimo do segredo e o `NODE_ENV`.

## Capabilities

### New Capabilities
- `service-runtime`: comportamento operacional do processo da API — health check público, validação das variáveis de ambiente na subida e encerramento gracioso.

### Modified Capabilities
- `api-docs`: a lista de operações do documento OpenAPI passa a incluir `GET /health`, e as operações públicas sem esquema Bearer passam a incluir `GET /health`.

## Impact

- **Código**: `src/main.ts` (validação de env, shutdown hooks, tratamento de erro na subida), novo controller/módulo de health, uma função pura de validação de env; `src/auth/auth.module.ts` e `src/auth/auth.service.ts` deixam de ser o único ponto de checagem (as mensagens continuam válidas como defesa).
- **Configuração**: `package.json` (scripts), novo `railway.json`, `.env.example`, README.
- **Testes**: unitários da validação de env; e2e de `/health` e atualização do e2e de documentação.
- **Banco**: nenhuma mudança de schema; as migrations existentes passam a ser aplicadas no pre-deploy.
- **Clientes da API**: nenhuma rota existente muda; `GET /health` é nova, pública e somente leitura.
- **Operação**: variáveis obrigatórias no Railway — `DATABASE_URL` (referência à rede privada do Postgres), `JWT_ACCESS_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NODE_ENV=production`; opcionais `JWT_ACCESS_EXPIRES_IN`, `REFRESH_TOKEN_TTL_DAYS`. `PORT` é injetada pelo Railway.

## Fora do escopo

- Rate limiting (decisão do usuário; segue para change própria).
- CORS: o frontend chama a API pelo servidor do Next.
- Provisionar o projeto/serviços no Railway e configurar o frontend na Vercel (operação, não código).
- Dockerfile: o build usa o Railpack padrão do Railway.
