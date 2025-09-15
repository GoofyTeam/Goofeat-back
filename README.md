# 🍽️ Goofeat Backend

**Système de recommandations de recettes anti-gaspi** - Backend NestJS pour l'application mobile Goofeat

Ce repository contient :
- 🥘 **Backend API NestJS** (`/app/`) - API de recommandations de recettes basées sur les ingrédients disponibles
- ☁️ **Infrastructure Terraform** (`/app_infra/`) - Déploiement sur AWS ECS

---

## 🚀 Démarrage Rapide - Backend API

### Développement Local

```bash
# Cloner et installer
git clone https://github.com/GoofyTeam/Goofeat-back.git
cd Goofeat-back/app
yarn install

# Services Docker (PostgreSQL, Elasticsearch, etc.)
docker compose up -d

# Démarrer en mode développement
yarn start:dev
```

➡️ **API Swagger** : http://localhost:3000/api/docs

### Documentation Complète

- 📖 **Architecture & Commands** : [CLAUDE.md](./CLAUDE.md)
- 📱 **Backend API** : [app/README.md](./app/README.md)
- 🔍 **Système de recherche** : [SEARCH_LOGIC.md](./SEARCH_LOGIC.md) et [SEARCH_SCORING.md](./SEARCH_SCORING.md)
- ⚙️ **Configuration** : [app/SETTINGS_DOCUMENTATION.md](./app/SETTINGS_DOCUMENTATION.md)

---

## ☁️ Déploiement AWS - Infrastructure

### Prérequis Terraform

- AWS account configuré
- Terraform installé
- AWS CLI avec credentials

> **Nix users** : `nix develop` pour environnement de développement

### Architecture AWS

- **ECR Repository** : Registry Docker pour les images
- **ECS Cluster & Service** : Orchestration et scaling des conteneurs
- **CI/CD Pipeline** : CodePipeline avec build/test/deploy automatique

### Déploiement

1. **Configuration des variables AWS**
   ```bash
   export AWS_ACCESS_KEY_ID=AKIA...
   export AWS_SECRET_ACCESS_KEY=abcd...
   export AWS_REGION=us-west-2
   ```

2. **Déploiement Terraform**
   ```bash
   cd app_infra/
   terraform init
   terraform apply
   ```

3. **Documentation détaillée** : [app_infra/README.md](./app_infra/README.md)

---

## 🏗️ Architecture Globale

```
Goofeat-Back/
├── 🍽️ app/                    # Backend NestJS API
│   ├── src/
│   │   ├── auth/              # JWT, OAuth (Google, Apple)
│   │   ├── users/             # Gestion utilisateurs
│   │   ├── recipes/           # CRUD recettes + search
│   │   ├── stocks/            # Inventaire utilisateur
│   │   ├── notifications/     # Push Firebase + emails
│   │   └── households/        # Gestion foyers familiaux
│   └── docker-compose.yml     # Services locaux
│
├── ☁️ app_infra/              # Infrastructure Terraform
│   ├── main.tf               # Configuration AWS ECS
│   └── variables.tf          # Variables environnement
│
└── 📚 Documentation/
    ├── CLAUDE.md            # Guide développement complet
    ├── SEARCH_*.md          # Système de recherche avancé
    └── app/SETTINGS_*.md    # Configuration utilisateur
```

## 🔍 Fonctionnalités Clés

### 🥘 Recommandations Intelligentes
- **Scoring personnalisé** basé sur les ingrédients possédés
- **Anti-gaspi** : priorité aux produits proches d'expiration
- **Recherche avancée** Elasticsearch avec scoring en temps réel

### 📱 Notifications Smart
- **Alertes d'expiration** configurables par utilisateur (1-14 jours)
- **Protection anti-spam** avec historique et logic de dédoublonnage
- **Mode digest familial** : instantané, quotidien, hebdomadaire

### 👨‍👩‍👧‍👦 Gestion Multi-foyers
- **4 types de foyers** : Famille, couple, colocation, personne seule
- **Permissions différenciées** enfants/adultes
- **Approbations automatiques** avec seuils configurables

---

## 🛠️ Stack Technique

- **Backend** : NestJS, TypeScript, TypeORM
- **Databases** : PostgreSQL, MongoDB, Elasticsearch
- **Auth** : JWT, OAuth2 (Google, Apple)
- **Notifications** : Firebase Cloud Messaging
- **Search** : Elasticsearch avec scoring personnalisé
- **Deploy** : AWS ECS, ECR, CodePipeline
- **Infra** : Terraform, Docker

---

## 🤝 Contribution

1. Fork le projet
2. Feature branch (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'feat: add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request

## 📄 License

MIT License - voir [LICENSE](./LICENSE) pour plus de détails