import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoginThrottlingService {
  private readonly logger = new Logger(LoginThrottlingService.name);
  private readonly failedAttempts: Map<
    string,
    { count: number; lastAttempt: Date }
  > = new Map();
  private readonly MAX_ATTEMPTS = 50;
  private readonly LOCK_TIME_MS = 10 * 60 * 1000; // 10 minutes en millisecondes

  /**
   * Enregistre une tentative de connexion échouée
   * @param identifier Email ou adresse IP
   * @returns Le nombre de tentatives échouées restantes avant verrouillage
   */
  registerFailedAttempt(identifier: string): number {
    const now = new Date();
    const record = this.failedAttempts.get(identifier);

    if (!record || this.isLockExpired(record.lastAttempt)) {
      this.failedAttempts.set(identifier, { count: 1, lastAttempt: now });
      return this.MAX_ATTEMPTS - 1;
    }

    const updatedCount = record.count + 1;
    this.failedAttempts.set(identifier, {
      count: updatedCount,
      lastAttempt: now,
    });

    return Math.max(0, this.MAX_ATTEMPTS - updatedCount);
  }

  /**
   * Vérifie si un identifiant est verrouillé
   * @param identifier Email ou adresse IP
   * @returns true si l'identifiant est verrouillé, false sinon
   */
  isLocked(identifier: string): boolean {
    const record = this.failedAttempts.get(identifier);

    if (!record) {
      return false;
    }

    if (this.isLockExpired(record.lastAttempt)) {
      this.resetAttempts(identifier);
      return false;
    }

    return record.count >= this.MAX_ATTEMPTS;
  }

  /**
   * Réinitialise le compteur de tentatives pour un identifiant
   * @param identifier Email ou adresse IP
   */
  resetAttempts(identifier: string): void {
    this.failedAttempts.delete(identifier);
    this.logger.debug(`Compteur réinitialisé pour ${identifier}`);
  }

  /**
   * Calcule le temps restant avant expiration du verrouillage
   * @param identifier Email ou adresse IP
   * @returns Temps restant en millisecondes
   */
  getRemainingLockTime(identifier: string): number {
    const record = this.failedAttempts.get(identifier);

    if (!record || record.count < this.MAX_ATTEMPTS) {
      return 0;
    }

    const elapsed = Date.now() - record.lastAttempt.getTime();
    return Math.max(0, this.LOCK_TIME_MS - elapsed);
  }

  /**
   * Vérifie si le délai de verrouillage est expiré
   * @param lastAttempt Date de la dernière tentative
   * @returns true si le délai est expiré, false sinon
   */
  private isLockExpired(lastAttempt: Date): boolean {
    const elapsed = Date.now() - lastAttempt.getTime();
    return elapsed > this.LOCK_TIME_MS;
  }
}
