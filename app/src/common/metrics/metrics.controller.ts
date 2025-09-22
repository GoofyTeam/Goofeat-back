import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { register } from 'prom-client';

@Controller()
export class MetricsController {
  @Get('metrics')
  @ApiExcludeEndpoint()
  async getMetrics(@Res() response: Response): Promise<void> {
    response.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    response.end(metrics);
  }

  @Get('health')
  @ApiExcludeEndpoint()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
