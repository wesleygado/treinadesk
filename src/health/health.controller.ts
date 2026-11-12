import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { ErrorResponse } from '../openapi/responses/error.response.js';
import { HealthResponse } from '../openapi/responses/health.response.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Rota pública usada pela plataforma de hospedagem. Responde 200 quando ' +
      'o banco de dados responde e 503 quando não.',
  })
  @ApiOkResponse({ type: HealthResponse })
  @ApiServiceUnavailableResponse({
    type: ErrorResponse,
    description: 'Banco de dados indisponível.',
  })
  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // Mensagem fixa: o erro do driver pode trazer host, usuário ou a URL.
      throw new ServiceUnavailableException('Banco de dados indisponível');
    }
    return { status: 'ok' };
  }
}
