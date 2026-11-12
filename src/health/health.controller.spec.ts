import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('responde { status: "ok" } quando o banco responde', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('lança 503 sem detalhes internos quando o banco não responde', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('connect ECONNREFUSED postgresql://user:segredo@host'),
    );

    const error = await controller.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = JSON.stringify(
      (error as ServiceUnavailableException).getResponse(),
    );
    expect(body).not.toContain('segredo');
    expect(body).not.toContain('postgresql://');
    expect(body).not.toContain('ECONNREFUSED');
  });
});
