import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Applicationn')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Endpoint de santé de l application' })
  @ApiResponse({
    status: 200,
    description: 'Application en cours d exécution',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Endpoint de santé de l application' })
  @ApiResponse({
    status: 200,
    description: 'Application en cours d exécution',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      lifetime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
    };
  }
}
