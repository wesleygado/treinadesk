import { validateEnv } from './validate-env.js';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/treinadesk',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
  };

  const errorsFor = (overrides: Record<string, string | undefined>) =>
    validateEnv({ ...valid, ...overrides });

  it('aceita a configuração mínima válida', () => {
    expect(validateEnv(valid)).toEqual([]);
  });

  describe('Variáveis obrigatórias conferidas na subida', () => {
    it.each([undefined, '', '   '])(
      'DATABASE_URL ausente ou vazia (%p) é recusada',
      (value) => {
        const errors = errorsFor({ DATABASE_URL: value });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/^DATABASE_URL: /);
      },
    );

    it('JWT_ACCESS_SECRET ausente é recusada', () => {
      const errors = errorsFor({ JWT_ACCESS_SECRET: undefined });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^JWT_ACCESS_SECRET: /);
    });

    it('JWT_ACCESS_SECRET com 20 caracteres é recusada', () => {
      const errors = errorsFor({ JWT_ACCESS_SECRET: 'b'.repeat(20) });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^JWT_ACCESS_SECRET: /);
    });

    it('JWT_ACCESS_SECRET com 32 caracteres é aceita', () => {
      expect(errorsFor({ JWT_ACCESS_SECRET: 'c'.repeat(32) })).toEqual([]);
    });
  });

  describe('Variáveis opcionais conferidas na subida', () => {
    it.each(['0', '-1', '1.5', 'abc', ''])(
      'REFRESH_TOKEN_TTL_DAYS=%p é recusada',
      (value) => {
        const errors = errorsFor({ REFRESH_TOKEN_TTL_DAYS: value });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/^REFRESH_TOKEN_TTL_DAYS: /);
      },
    );

    it('REFRESH_TOKEN_TTL_DAYS ausente ou inteiro positivo é aceita', () => {
      expect(errorsFor({ REFRESH_TOKEN_TTL_DAYS: undefined })).toEqual([]);
      expect(errorsFor({ REFRESH_TOKEN_TTL_DAYS: '7' })).toEqual([]);
    });

    it.each(['abc', '0', '70000', '80.5', ''])(
      'PORT=%p é recusada',
      (value) => {
        const errors = errorsFor({ PORT: value });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/^PORT: /);
      },
    );

    it('PORT ausente ou válida é aceita', () => {
      expect(errorsFor({ PORT: undefined })).toEqual([]);
      expect(errorsFor({ PORT: '8080' })).toEqual([]);
    });
  });

  describe('Mensagem de configuração inválida sem segredos', () => {
    it('cita todas as variáveis inválidas sem mostrar valores', () => {
      const errors = validateEnv({
        JWT_ACCESS_SECRET: 'curto',
        PORT: 'porta-secreta',
      });
      const names = errors.map((error) => error.split(':')[0]);
      expect(names.sort()).toEqual([
        'DATABASE_URL',
        'JWT_ACCESS_SECRET',
        'PORT',
      ]);
      for (const error of errors) {
        expect(error).not.toContain('curto');
        expect(error).not.toContain('porta-secreta');
      }
    });
  });
});
