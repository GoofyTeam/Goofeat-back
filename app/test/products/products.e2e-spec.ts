/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SeederModule } from 'src/common/database/seeds/seeder.module';
import { SeederService } from 'src/common/database/seeds/seeder.service';
import { Product } from 'src/products/entities/product.entity';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Product E2E - OpenFoodFacts import & ingredient link', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, SeederModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const seederService = moduleFixture.get<SeederService>(SeederService);

    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );

    await seederService.seedAll();
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it("crée un produit Panzani Torti et lie ses ingrédients, dont 'semoule de blé dur'", async () => {
    // Code-barres d'un produit Panzani Torti
    const barcode = '3038350023605';
    const res = await request(app.getHttpServer())
      .get('/product/barcode/' + barcode)
      .send()
      .expect(200);
    const body: Product = res.body as Product;

    // Vérifie les propriétés de base du produit
    expect(body).toHaveProperty('code', barcode);
    expect(body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(body.name).toMatch('Torti');

    // Vérifie que le produit a une liste d'ingrédients
    expect(body.ingredients).toBeDefined();
    expect(Array.isArray(body.ingredients)).toBe(true);
    expect(body.ingredients.length).toBeGreaterThan(0);

    // Vérifie que la liste contient bien l'ingrédient attendu
    expect(body.ingredients.map((i) => i.offTag)).toContain(
      'en:superior-quality-durum-wheat-semolina',
    );
  }, 30000);
});
