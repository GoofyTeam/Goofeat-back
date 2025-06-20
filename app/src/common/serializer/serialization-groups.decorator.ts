import { SetMetadata } from '@nestjs/common';
import { SERIALIZATION_GROUP_KEY } from './serializer.interceptor';

/**
 * Définit les groupes de sérialisation à utiliser pour la transformation des réponses
 * @param groups Les groupes de sérialisation à appliquer
 * @returns Décorateur pour les contrôleurs ou les méthodes de contrôleur
 */
export const SerializationGroups = (...groups: string[]) =>
  SetMetadata(SERIALIZATION_GROUP_KEY, groups);
