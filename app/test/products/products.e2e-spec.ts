import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Product } from 'src/products/entities/product.entity';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Ingredient } from '../../src/ingredients/entities/ingredient.entity';

describe('Product E2E - OpenFoodFacts import & ingredient link', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let ingredient: Ingredient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    // Clean DB before test (optionnel, à adapter selon stratégie)
    // await dataSource.getRepository(Product).delete({});
    // await dataSource.getRepository(Ingredient).delete({});
    // // Crée un ingrédient en base qui correspond à un tag OFF connu

    ingredient = (await dataSource.getRepository(Ingredient).findOne({
      where: { offTag: 'en:superior-quality-durum-wheat-semolina' },
    })) as Ingredient;
  });

  afterAll(async () => {
    await app.close();
  });

  it("crée un produit depuis OFF et lie correctement l'ingrédient", async () => {
    // Code-barres d\'un produit Nutella (contenant des noisettes)
    const barcode = '3038350023605';
    const res = await request(app.getHttpServer())
      .post('/product/barcode/' + barcode)
      .send()
      .expect(201);
    const body: Product = res.body as Product;

    expect(body).toHaveProperty('id', barcode);
    expect(body).toHaveProperty('ingredientId', ingredient.id);
    expect(body.ingredient).toBeDefined();
    expect(body.ingredient.offTag).toBe(
      'en:superior-quality-durum-wheat-semolina',
    );
    expect(body.name).toMatch('Torti');
    // expect(res.body.rawData).toBeDefined();
  });
});
