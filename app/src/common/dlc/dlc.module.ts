import { Module } from '@nestjs/common';
import { DlcRulesService } from './dlc-rules.service';

@Module({
  providers: [DlcRulesService],
  exports: [DlcRulesService],
})
export class DlcModule {}
