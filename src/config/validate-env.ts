// Confere as variáveis de ambiente antes de a API aceitar conexões. Devolve
// uma mensagem por variável inválida, no formato "NOME: motivo". As mensagens
// nunca incluem o valor recebido: ele pode ser um segredo.
const MIN_JWT_SECRET_LENGTH = 32;

type Env = Record<string, string | undefined>;

const isPositiveInteger = (value: string) => /^[1-9]\d*$/.test(value.trim());

export function validateEnv(env: Env): string[] {
  const errors: string[] = [];

  if (!env.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL: obrigatória');
  }

  const secret = env.JWT_ACCESS_SECRET;
  if (!secret?.trim()) {
    errors.push('JWT_ACCESS_SECRET: obrigatória');
  } else if (secret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(
      `JWT_ACCESS_SECRET: deve ter no mínimo ${MIN_JWT_SECRET_LENGTH} caracteres`,
    );
  }

  const ttl = env.REFRESH_TOKEN_TTL_DAYS;
  if (ttl !== undefined && !isPositiveInteger(ttl)) {
    errors.push('REFRESH_TOKEN_TTL_DAYS: deve ser um inteiro positivo');
  }

  const port = env.PORT;
  if (
    port !== undefined &&
    !(isPositiveInteger(port) && Number(port) <= 65535)
  ) {
    errors.push('PORT: deve ser um inteiro entre 1 e 65535');
  }

  return errors;
}
