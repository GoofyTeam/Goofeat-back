# Goofeat Backend API

Backend NestJS pour l'application mobile Goofeat - Un système de recommandations de recettes anti-gaspi basé sur les ingrédients disponibles.

## 🚀 Démarrage Rapide

### Prérequis

- Node.js 18+
- Yarn
- Docker & Docker Compose
- PostgreSQL, MongoDB, Elasticsearch

### Installation

```bash
# Installation des dépendances
yarn install

# Démarrer les services Docker
docker compose up -d

# Lancer les migrations
yarn migration:run

# Optionnel : Seeds la base avec des données de test
yarn seed
```

### Développement

```bash
# Mode développement avec hot reload
yarn start:dev

# Mode debug
yarn start:debug

# Build pour production
yarn build && yarn start:prod
```

## 📚 Documentation

- **API Swagger**: http://localhost:3000/api/docs
- **Architecture**: Voir [CLAUDE.md](../CLAUDE.md) pour la documentation complète
- **Système de recherche**: [SEARCH_LOGIC.md](../SEARCH_LOGIC.md) et [SEARCH_SCORING.md](../SEARCH_SCORING.md)
- **Configuration des paramètres**: [SETTINGS_DOCUMENTATION.md](./SETTINGS_DOCUMENTATION.md)

## 🧪 Tests

```bash
# Tests unitaires
yarn test

# Tests avec watch mode
yarn test:watch

# Tests avec coverage
yarn test:cov

# Tests end-to-end
yarn test:e2e
```

## 🔧 Utilitaires

```bash
# Vérifier les expirations manuellement
yarn check:expirations

# Preview des notifications (sans envoyer)
yarn check:expirations --dry-run

# Tests de recherche
yarn test:search

# Import de recettes depuis Spoonacular
yarn import:spoonacular:recipes

# Créer un utilisateur de test pour mobile
yarn cli setup:test-user
```

## 🏗️ Architecture

### Structure des Modules

- `auth/` - Authentification JWT, OAuth (Google, Apple)
- `users/` - Gestion utilisateurs et préférences
- `products/` - Catalogue produits avec OpenFoodFacts
- `recipes/` - CRUD recettes avec indexation Elasticsearch
- `stocks/` - Inventaire utilisateur avec suivi d'expiration
- `notifications/` - Push Firebase et emails d'alerte
- `households/` - Gestion des foyers familiaux

### Services Partagés

- `common/elasticsearch/` - Service de recherche avec scoring personnalisé
- `common/database/` - Configuration TypeORM et migrations
- `common/mail/` - Service d'email avec templates Handlebars
- `common/logger/` - Logging avec Winston et rotation quotidienne

## 🔍 Fonctionnalités Principales

### Système de Recherche Avancé

- **Scoring personnalisé** basé sur les ingrédients possédés
- **Priorité anti-gaspi** pour les produits proches d'expiration
- **Filtrage par préférences** alimentaires et catégories

### Notifications Intelligentes

- **Alertes d'expiration** configurables par utilisateur
- **Protection anti-spam** avec historique
- **Mode digest** familial (instantané/quotidien/hebdomadaire)

### Gestion Multi-foyers

- **Types de foyers** : Famille, couple, colocation, personne seule
- **Permissions différenciées** entre adultes et enfants
- **Approbations automatiques** avec seuils configurables

## 🌐 Services Docker

```bash
# Services disponibles après docker compose up -d
- PostgreSQL: localhost:5432
- MongoDB: localhost:27017
- Elasticsearch: localhost:9200
- Kibana: localhost:5601
- MailHog (tests email): localhost:8025
- Adminer (DB admin): localhost:8081
```

## 🔐 Variables d'Environnement

Créez un fichier `.env` basé sur `.env.example` :

```bash
# Base de données
DATABASE_URL="postgresql://user:pass@localhost:5432/goofeat"
MONGODB_URI="mongodb://localhost:27017/goofeat"
ELASTICSEARCH_URL="http://localhost:9200"

# Authentification
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="7d"

# OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Firebase (notifications push)
FIREBASE_PROJECT_ID="your-firebase-project"
FIREBASE_SERVICE_ACCOUNT_PATH="./firebase-admin-key.json"

# Email
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT=587
SMTP_USER="your-smtp-user"
SMTP_PASSWORD="your-smtp-password"

# APIs externes
SPOONACULAR_API_KEY="your-spoonacular-key"
```

## 📊 Monitoring et Logs

- **Elasticsearch logs** indexés automatiquement
- **Winston logging** avec rotation quotidienne
- **Métriques de performance** sur les recherches
- **Statistiques d'usage** par utilisateur

## 🚀 Déploiement

- **Conteneurisation** Docker multi-stage optimisée
- **Infrastructure** Terraform sur AWS ECS
- **CI/CD** GitHub Actions avec tests automatisés
- **Monitoring** CloudWatch et logs centralisés

Pour plus de détails sur le déploiement, voir [../app_infra/README.md](../app_infra/README.md).

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'feat: add amazing feature'`)
4. Push la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 License

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.
