# Spec Delta

## Purpose

Define o comportamento operacional do processo da API em produção: um health check público para a plataforma de hospedagem, a recusa em subir com configuração inválida e o encerramento gracioso ao receber sinal de parada.

## ADDED Requirements

### Requirement: Health check público
O sistema SHALL expor a rota `GET /health`, acessível sem token em qualquer ambiente. Quando o banco de dados responde a uma consulta, a resposta MUST ter status `200` e corpo `{ "status": "ok" }`. Quando o banco não responde, a resposta MUST ter status `503`. O corpo MUST NOT conter dados de configuração, credenciais, mensagens internas do banco nem informações de usuários.

#### Scenario: API e banco disponíveis
- **GIVEN** que a API está em execução e o banco responde
- **WHEN** um cliente envia `GET /health` sem o cabeçalho `Authorization`
- **THEN** a resposta tem status `200`
- **AND** o corpo é `{ "status": "ok" }`

#### Scenario: Banco indisponível
- **GIVEN** que a API está em execução e o banco não responde
- **WHEN** um cliente envia `GET /health`
- **THEN** a resposta tem status `503`
- **AND** o corpo não contém a URL de conexão nem a mensagem de erro do banco

#### Scenario: Health check ignora token inválido
- **GIVEN** que a API está em execução e o banco responde
- **WHEN** um cliente envia `GET /health` com `Authorization: Bearer token-invalido`
- **THEN** a resposta tem status `200`

### Requirement: Variáveis obrigatórias conferidas na subida
O sistema MUST conferir as variáveis de ambiente antes de aceitar conexões HTTP. `DATABASE_URL` ausente ou vazia e `JWT_ACCESS_SECRET` ausente ou com menos de 32 caracteres MUST impedir a subida: o processo MUST encerrar com código diferente de zero sem abrir a porta HTTP.

#### Scenario: DATABASE_URL ausente
- **GIVEN** que `DATABASE_URL` não está definida
- **WHEN** a API é iniciada
- **THEN** o processo encerra com código diferente de zero
- **AND** a porta HTTP não é aberta

#### Scenario: Segredo JWT curto
- **GIVEN** que `JWT_ACCESS_SECRET` tem 20 caracteres
- **WHEN** a API é iniciada
- **THEN** o processo encerra com código diferente de zero

#### Scenario: Configuração válida
- **GIVEN** que `DATABASE_URL` está definida e `JWT_ACCESS_SECRET` tem 32 caracteres ou mais
- **WHEN** a API é iniciada
- **THEN** a API passa a aceitar conexões na porta configurada

### Requirement: Variáveis opcionais conferidas na subida
Quando definidas, `REFRESH_TOKEN_TTL_DAYS` MUST ser um inteiro positivo e `PORT` MUST ser um inteiro entre 1 e 65535; valor inválido MUST impedir a subida com código diferente de zero. Quando ausentes, MUST valer os padrões: `REFRESH_TOKEN_TTL_DAYS` 7 e `PORT` 3000.

#### Scenario: TTL do refresh token inválido
- **GIVEN** que `REFRESH_TOKEN_TTL_DAYS` vale `0`
- **WHEN** a API é iniciada
- **THEN** o processo encerra com código diferente de zero antes de qualquer login

#### Scenario: Porta inválida
- **GIVEN** que `PORT` vale `abc`
- **WHEN** a API é iniciada
- **THEN** o processo encerra com código diferente de zero

#### Scenario: Padrões aplicados
- **GIVEN** que `REFRESH_TOKEN_TTL_DAYS` e `PORT` não estão definidas e as obrigatórias são válidas
- **WHEN** a API é iniciada
- **THEN** a API aceita conexões na porta `3000`

### Requirement: Mensagem de configuração inválida sem segredos
Ao recusar a subida por configuração inválida, o sistema MUST registrar uma mensagem que nomeia cada variável inválida e o motivo. A mensagem MUST NOT conter o valor de nenhuma variável de ambiente.

#### Scenario: Várias variáveis inválidas
- **GIVEN** que `DATABASE_URL` não está definida e `JWT_ACCESS_SECRET` vale `curto`
- **WHEN** a API é iniciada
- **THEN** a mensagem registrada cita `DATABASE_URL` e `JWT_ACCESS_SECRET`
- **AND** a mensagem não contém o texto `curto`

### Requirement: Encerramento gracioso
Ao receber `SIGTERM` ou `SIGINT`, o sistema MUST parar de aceitar novas conexões, encerrar as conexões com o banco de dados e terminar o processo com código `0`. Uma falha durante a subida que não seja de configuração (por exemplo, porta ocupada) MUST encerrar o processo com código `1`.

#### Scenario: Sinal de parada da plataforma
- **GIVEN** que a API está em execução e conectada ao banco
- **WHEN** o processo recebe `SIGTERM`
- **THEN** as conexões com o banco são encerradas
- **AND** o processo termina com código `0`

#### Scenario: Porta ocupada
- **GIVEN** que outra aplicação já escuta na porta configurada
- **WHEN** a API é iniciada
- **THEN** o processo termina com código `1`

### Requirement: Rotas existentes preservadas
A inclusão do health check e das verificações de subida MUST NOT alterar status, corpo, validação, autenticação ou autorização de nenhuma rota existente.

#### Scenario: Raiz continua protegida
- **GIVEN** que a API está em execução
- **WHEN** um cliente envia `GET /` sem token
- **THEN** a resposta tem status `401`
