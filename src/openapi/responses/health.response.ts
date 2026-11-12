import { ApiProperty } from '@nestjs/swagger';

// Espelha o retorno de HealthController.check (src/health/).
export class HealthResponse {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status: 'ok';
}
