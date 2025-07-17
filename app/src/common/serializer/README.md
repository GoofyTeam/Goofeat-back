# Système de Sérialisation avec Groupes

Ce module permet de contrôler dynamiquement les champs exposés lors du retour d'entités via un système de groupes de sérialisation.

## Fonctionnalités

- Contrôle fin des champs exposés dans les réponses API
- Sélection dynamique des groupes via les paramètres de requête
- Possibilité de définir des groupes par défaut au niveau des contrôleurs
- Compatible avec la documentation Swagger

## Utilisation

### 1. Décoration des entités

Utilisez le décorateur `@Expose()` de `class-transformer` pour spécifier les groupes auxquels chaque propriété appartient :

```typescript
import { Expose } from 'class-transformer';

export class Product {
  @Expose({ groups: ['default', 'product:read', 'product:list'] })
  id: string;

  @Expose({ groups: ['default', 'product:read', 'product:list'] })
  name: string;

  @Expose({ groups: ['product:read'] })
  description: string;

  @Expose({ groups: ['admin', 'debug'] })
  rawData: any;
}
```

### 2. Utilisation dans les contrôleurs

Utilisez le décorateur `@SerializationGroups()` pour définir les groupes par défaut pour une route :

```typescript
import { SerializationGroups } from '../../common/serializer/serialization-groups.decorator';

@Controller('products')
export class ProductController {
  @SerializationGroups('product:list', 'default')
  @Get()
  findAll() {
    // ...
  }

  @SerializationGroups('product:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    // ...
  }
}
```

### 3. Sélection dynamique des groupes

Les clients peuvent spécifier les groupes souhaités via le paramètre de requête `groups` :

```
GET /products?groups=product:list,nutrition
GET /products/123?groups=product:read,admin,debug
```

Le système utilise :

- `class-transformer` pour la transformation des objets
- Un intercepteur personnalisé (`SerializerInterceptor`) qui applique la transformation
- Un décorateur personnalisé (`SerializationGroups`) pour définir les groupes au niveau des contrôleurs

L'intercepteur récupère les groupes depuis :

1. Les paramètres de requête (`?groups=x,y,z`)
2. Les en-têtes HTTP (`serialization-groups: x,y,z`)
3. Les métadonnées définies par le décorateur `@SerializationGroups`

Si aucun groupe n'est spécifié, le groupe `default` est utilisé.
