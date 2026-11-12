# Spec Delta

## MODIFIED Requirements

### Requirement: Documento OpenAPI público
O sistema SHALL expor a rota `GET /docs-json`, acessível sem token em qualquer ambiente, que responde `200` com um documento OpenAPI 3 em JSON. O documento MUST ter título "TreinaDesk API" e MUST listar todas as rotas da API com o mesmo método e caminho que elas atendem, com os parâmetros de caminho escritos no formato OpenAPI (`{id}`). As rotas `/docs` e `/docs-json` MUST NOT constar no documento.

#### Scenario: Documento OpenAPI sem token
- **GIVEN** que a API está em execução
- **WHEN** um cliente envia `GET /docs-json` sem o cabeçalho `Authorization`
- **THEN** a resposta tem status `200` com `Content-Type` `application/json`
- **AND** o corpo tem `openapi` começando com `"3."` e `info.title` igual a `"TreinaDesk API"`

#### Scenario: Todas as rotas presentes
- **GIVEN** que a API está em execução
- **WHEN** um cliente envia `GET /docs-json`
- **THEN** `paths` contém exatamente as operações `POST /users`, `POST /users/staff`, `GET /users`, `GET /users/me`, `PATCH /users/{id}/role`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /categories`, `POST /categories`, `PATCH /categories/{id}`, `POST /tickets`, `GET /tickets`, `GET /tickets/{id}`, `PATCH /tickets/{id}/assign`, `PATCH /tickets/{id}/status`, `POST /tickets/{ticketId}/comments`, `GET /tickets/{ticketId}/comments`, `GET /health` e `GET /`
- **AND** `paths` não contém `/docs` nem `/docs-json`

### Requirement: Autenticação descrita no documento OpenAPI
O documento OpenAPI MUST declarar um esquema de segurança HTTP Bearer com formato JWT. Toda operação que exige access token MUST referenciar esse esquema e MUST listar a resposta `401`. As operações públicas (`POST /users`, `POST /auth/login`, `POST /auth/refresh` e `GET /health`) MUST NOT referenciar esquema de segurança. Operações restritas por papel MUST listar a resposta `403` e MUST informar na descrição os papéis aceitos.

#### Scenario: Esquema Bearer declarado
- **WHEN** um cliente envia `GET /docs-json`
- **THEN** `components.securitySchemes` contém um esquema com `type` `"http"`, `scheme` `"bearer"` e `bearerFormat` `"JWT"`

#### Scenario: Rota protegida exige o esquema
- **WHEN** um cliente envia `GET /docs-json`
- **THEN** a operação `GET /tickets` referencia o esquema Bearer em `security`
- **AND** lista a resposta `401`

#### Scenario: Rotas públicas sem esquema
- **WHEN** um cliente envia `GET /docs-json`
- **THEN** as operações `POST /users`, `POST /auth/login`, `POST /auth/refresh` e `GET /health` não têm `security` com o esquema Bearer

#### Scenario: Rota restrita por papel
- **WHEN** um cliente envia `GET /docs-json`
- **THEN** a operação `POST /categories` lista as respostas `401` e `403`
- **AND** sua descrição menciona o papel `ADMIN`

