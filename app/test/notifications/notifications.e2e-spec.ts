/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Category } from '../../src/categories/entities/category.entity';
import { ExpirationCheckService } from '../../src/notifications/expiration-check.service';
import { NotificationService } from '../../src/notifications/notification.service';
import { Product } from '../../src/products/entities/product.entity';
import { Stock } from '../../src/stocks/entities/stock.entity';
import { User } from '../../src/users/entity/user.entity';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let stockRepository: Repository<Stock>;
  let productRepository: Repository<Product>;
  let categoryRepository: Repository<Category>;
  let jwtService: JwtService;
  let notificationService: NotificationService;
  let expirationCheckService: ExpirationCheckService;

  let testUser: User;
  let testProduct: Product;
  let testCategory: Category;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Récupérer les repositories et services
    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    stockRepository = moduleFixture.get<Repository<Stock>>(
      getRepositoryToken(Stock),
    );
    productRepository = moduleFixture.get<Repository<Product>>(
      getRepositoryToken(Product),
    );
    categoryRepository = moduleFixture.get<Repository<Category>>(
      getRepositoryToken(Category),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);
    notificationService =
      moduleFixture.get<NotificationService>(NotificationService);
    expirationCheckService = moduleFixture.get<ExpirationCheckService>(
      ExpirationCheckService,
    );
  });

  beforeEach(async () => {
    // Nettoyer les données de test dans le bon ordre (relations)
    // await stockRepository.createQueryBuilder().delete().execute();
    // await productRepository.createQueryBuilder().delete().execute();
    // await categoryRepository.createQueryBuilder().delete().execute();
    // await userRepository.createQueryBuilder().delete().execute();

    // Créer une catégorie de test
    testCategory = await categoryRepository.save({
      name: 'Test Category',
      description: 'Category for testing',
    });

    // Créer un produit de test
    testProduct = await productRepository.save({
      name: 'Test Product',
      description: 'Product for testing notifications',
      category: testCategory,
      defaultDlcTime: '7 days',
      barcode: 'TEST123456789',
      imageUrl: 'https://example.com/test-product.jpg',
    });

    // Créer un utilisateur de test
    const timestamp = Date.now();
    testUser = await userRepository.save({
      firstName: 'Test',
      lastName: 'User',
      email: `test-${timestamp}@example.com`,
      password: 'hashedpassword',
      isActive: true,
      fcmToken: 'test-fcm-token-' + timestamp,
    });

    // Générer un token JWT pour l'utilisateur
    authToken = jwtService.sign({
      sub: testUser.id,
      email: testUser.email,
    });

    // Token généré
  });

  afterAll(async () => {
    await app.close();
  });

  describe('FCM Token Management', () => {
    it('should register FCM token', async () => {
      const newToken = 'new-fcm-token-' + Date.now();

      const response = await request(app.getHttpServer())
        .post('/notifications/fcm-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fcmToken: newToken })
        .expect(200);

      expect(response.body.message).toBe('Token FCM mis à jour avec succès');

      // Vérifier que le token a été mis à jour en base
      const updatedUser = await userRepository.findOne({
        where: { id: testUser.id },
      });
      expect(updatedUser?.fcmToken).toBe(newToken);
    });

    it('should remove FCM token', async () => {
      const response = await request(app.getHttpServer())
        .post('/notifications/fcm-token/remove')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Token FCM supprimé avec succès');

      // Vérifier que le token a été supprimé en base
      const updatedUser = await userRepository.findOne({
        where: { id: testUser.id },
      });
      // Le token peut être undefined ou null selon la base de données
      expect(updatedUser?.fcmToken).toBeFalsy();
    });

    it('should require authentication for FCM endpoints', async () => {
      await request(app.getHttpServer())
        .post('/notifications/fcm-token')
        .send({ fcmToken: 'test-token' })
        .expect(401);

      await request(app.getHttpServer())
        .post('/notifications/fcm-token/remove')
        .expect(401);
    });
  });

  describe('Test Notification', () => {
    it('should send test notification successfully', async () => {
      // Mock du service de notification pour éviter l'envoi réel
      const mockSendNotification = jest
        .spyOn(notificationService, 'sendNotificationToUser')
        .mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post('/notifications/test-notification')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        'Notification de test envoyée avec succès !',
      );

      // Vérifier que le service a été appelé avec les bons paramètres
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: testUser.id }),
        expect.objectContaining({
          title: '🧪 Notification de test',
          body: expect.stringContaining(testUser.firstName),
          data: expect.objectContaining({
            type: 'test',
            userId: testUser.id,
          }),
        }),
      );

      mockSendNotification.mockRestore();
    });

    it('should fail when user has no FCM token', async () => {
      // Supprimer le token FCM de l'utilisateur directement en base
      await userRepository.update(testUser.id, { fcmToken: null });

      const response = await request(app.getHttpServer())
        .post('/notifications/test-notification')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        'Aucun token FCM enregistré pour cet utilisateur',
      );
    });
  });

  describe('Expiration Stats', () => {
    it('should return expiration statistics', async () => {
      // Créer des stocks avec différentes dates d'expiration
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      // Stock qui expire demain (dans moins de 3 jours)
      await stockRepository.save({
        product: testProduct,
        user: testUser,
        quantity: 2,
        dlc: tomorrow,
      });

      // Stock qui expire dans une semaine (pas d'alerte)
      await stockRepository.save({
        product: testProduct,
        user: testUser,
        quantity: 1,
        dlc: nextWeek,
      });

      const response = await request(app.getHttpServer())
        .get('/notifications/expiration-stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('expiringSoon');
      expect(response.body).toHaveProperty('expiredToday');
      expect(response.body).toHaveProperty('totalExpiring');
      expect(response.body.expiringSoon).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Expiration Check', () => {
    it('should trigger manual expiration check', async () => {
      // Mock du service pour éviter l'exécution réelle
      const mockTriggerCheck = jest
        .spyOn(expirationCheckService, 'triggerExpirationCheck')
        .mockResolvedValue();

      const response = await request(app.getHttpServer())
        .post('/notifications/test-expiration-check')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe(
        'Vérification des expirations déclenchée',
      );
      expect(mockTriggerCheck).toHaveBeenCalled();

      mockTriggerCheck.mockRestore();
    });
  });

  describe('Notification Service Unit Tests', () => {
    it('should create proper expiration notification for single product', () => {
      const mockStock = {
        id: 'test-stock-id',
        product: { name: 'Test Product' },
        user: testUser,
        quantity: 1,
        dlc: new Date(),
      } as Stock;

      const notification = notificationService.createExpirationNotification([
        mockStock,
      ]);

      expect(notification.title).toBe('⚠️ Produit bientôt périmé');
      expect(notification.body).toContain('Test Product');
      expect(notification.body).toContain('expire dans moins de 3 jours');
      expect(notification.data?.type).toBe('expiration');
      expect(notification.data?.stockId).toBe('test-stock-id');
    });

    it('should create proper expiration notification for multiple products', () => {
      const mockStocks = [
        {
          id: 'stock-1',
          product: { name: 'Product 1' },
          user: testUser,
          quantity: 1,
          dlc: new Date(),
        },
        {
          id: 'stock-2',
          product: { name: 'Product 2' },
          user: testUser,
          quantity: 1,
          dlc: new Date(),
        },
      ] as Stock[];

      const notification =
        notificationService.createExpirationNotification(mockStocks);

      expect(notification.title).toBe('⚠️ Produits bientôt périmés');
      expect(notification.body).toContain('2 produits expirent');
      expect(notification.body).toContain('Product 1');
      expect(notification.data?.type).toBe('expiration');
      expect(notification.data?.count).toBe('2');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete notification flow', async () => {
      // 1. Enregistrer un token FCM
      await request(app.getHttpServer())
        .post('/notifications/fcm-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fcmToken: 'integration-test-token' })
        .expect(200);

      // 2. Créer un stock qui expire bientôt
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await stockRepository.save({
        product: testProduct,
        user: testUser,
        quantity: 1,
        dlc: tomorrow,
      });

      // 3. Vérifier les statistiques
      const statsResponse = await request(app.getHttpServer())
        .get('/notifications/expiration-stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statsResponse.body.expiringSoon).toBeGreaterThanOrEqual(1);

      // 4. Tester l'envoi de notification
      const mockSendNotification = jest
        .spyOn(notificationService, 'sendNotificationToUser')
        .mockResolvedValue(true);

      await request(app.getHttpServer())
        .post('/notifications/test-notification')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockSendNotification).toHaveBeenCalled();
      mockSendNotification.mockRestore();
    });
  });
});
