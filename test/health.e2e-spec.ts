import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Health check (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health check público', () => {
    it('GET /health sem token responde 200 com { status: "ok" }', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /health ignora token inválido', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('Authorization', 'Bearer token-invalido')
        .expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('Rotas existentes preservadas', () => {
    it('GET / sem token continua 401', () => {
      return request(app.getHttpServer()).get('/').expect(401);
    });
  });
});
