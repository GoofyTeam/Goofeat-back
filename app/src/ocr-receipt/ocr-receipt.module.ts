import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import { ProductModule } from '../products/product.module';
import { StockModule } from '../stocks/stock.module';
import { ReceiptItem } from './entities/receipt-item.entity';
import { Receipt } from './entities/receipt.entity';
import { OcrReceiptController } from './ocr-receipt.controller';
import { OcrReceiptService } from './ocr-receipt.service';
import { CarrefourParser } from './parsers/carrefour.parser';
import { FrenchReceiptParser } from './parsers/french-receipt.parser';
import { GenericParser } from './parsers/generic.parser';
import { LeclercParser } from './parsers/leclerc.parser';
import { ImageOptimizerService } from './preprocessing/image-optimizer.service';
import { TesseractProvider } from './providers/tesseract.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receipt, ReceiptItem]),
    MulterModule.register({
      storage: memoryStorage(), // FORCE le stockage en mémoire
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
          return callback(
            new Error('Seuls les fichiers JPG, PNG et PDF sont autorisés'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max pour éviter surcharge mémoire
        files: 1, // Un seul fichier par requête
      },
    }),
    ProductModule,
    StockModule,
  ],
  controllers: [OcrReceiptController],
  providers: [
    OcrReceiptService,
    ImageOptimizerService,
    TesseractProvider,
    FrenchReceiptParser,
    CarrefourParser,
    LeclercParser,
    GenericParser,
  ],
  exports: [OcrReceiptService],
})
export class OcrReceiptModule {}
