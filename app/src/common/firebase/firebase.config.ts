import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseConfig {
  private app: admin.app.App;

  constructor(private readonly configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    const serviceAccountPath = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

    if (!serviceAccountPath || !projectId) {
      console.warn(
        'Firebase configuration manquante. Les notifications FCM ne seront pas disponibles.',
      );
      return;
    }

    try {
      if (admin.apps.length === 0) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
          projectId: projectId,
        });
      } else {
        this.app = admin.apps[0] as admin.app.App;
      }
    } catch (error) {
      console.error("Erreur lors de l'initialisation de Firebase:", error);
    }
  }

  getMessaging(): admin.messaging.Messaging | null {
    if (!this.app) {
      return null;
    }
    return admin.messaging(this.app);
  }

  isConfigured(): boolean {
    return !!this.app;
  }
}
