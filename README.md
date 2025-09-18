# 🍽️ Goofeat Backend

**Système de recommandations de recettes anti-gaspi** - Backend NestJS pour l'application mobile Goofeat

Ce repository contient :

- 🥘 **Backend API NestJS** (`/app/`) - API de recommandations de recettes basées sur les ingrédients disponibles
- ☁️ **Infrastructure Kubernetes** (`/k8s/`) - Déploiement optimisé avec auto-scaling
- 📊 **Optimisations DevOps** - HPA, Ingress, Health Checks & Monitoring

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
➡️ **Elasticsearch** : http://localhost:9200
➡️ **Kibana** : http://localhost:5601

### Documentation Complète

- 📖 **Architecture & Commands** : [CLAUDE.md](./CLAUDE.md)
- 📱 **Backend API** : [app/README.md](./app/README.md)
- 🔍 **Système de recherche** : [SEARCH_LOGIC.md](./SEARCH_LOGIC.md) et [SEARCH_SCORING.md](./SEARCH_SCORING.md)
- ⚙️ **Configuration** : [app/SETTINGS_DOCUMENTATION.md](./app/SETTINGS_DOCUMENTATION.md)
- 🚀 **Optimisations K8s** : [OPTIMIZATIONS_KUBERNETES.md](./OPTIMIZATIONS_KUBERNETES.md)

---

## 🏗️ Architecture Technique

### Infrastructure de Développement

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND MOBILE                          │
│  React Native 0.79.4 + Expo 53.0.15                       │
│  • NativeWind (TailwindCSS)                                │
│  • Expo Router + TypeScript                                │
│  • Port: 4200                                              │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTP/REST API
┌───────────────────▼─────────────────────────────────────────┐
│                API GATEWAY                                  │
│  NestJS 11.0.1 (Node.js 22)                               │
│  • JWT Auth + Passport (Google/Apple OAuth)               │
│  • Rate Limiting + CORS                                   │
│  • Swagger Documentation                                  │
│  • Health Checks (/api/v1/health)                        │
│  • Port: 3000                                            │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                DATA LAYER                                   │
│ ┌─────────────────┬─────────────────┬─────────────────────┐ │
│ │   PostgreSQL    │  Elasticsearch  │      Services       │ │
│ │   (NeonDB)      │    v8.11.2      │                     │ │
│ │   • TypeORM     │  • French       │ MongoDB (dev)       │ │
│ │   • Migrations  │  • Analyzer     │ MailHog (test)      │ │
│ │   • Seeding     │  • Anti-waste   │ Kibana v8.11.2     │ │
│ │                 │  • Scoring      │ Adminer (DB admin)  │ │
│ └─────────────────┴─────────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Infrastructure de Production Kubernetes

```yaml
Production Architecture:
┌─────────────────────────────────────────────────────────────┐
│                   INGRESS NGINX                             │
│  • Load Balancer (tedjy.ddns.net)                         │
│  • Rate Limiting: 100 req/min                             │
│  • CORS + SSL/TLS ready                                   │
│  • Cache headers optimisées                               │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│            HORIZONTAL POD AUTOSCALER                        │
│  • Replicas: 2-10 (auto-scaling)                          │
│  • CPU target: 70%                                        │
│  • Memory target: 80%                                     │
│  • Smart scaling policies                                 │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                 POD REPLICAS                                │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│ │   Pod 1     │   Pod 2     │   Pod N     │   Pod N+1   │  │
│ │ Resources:  │ Resources:  │ Resources:  │ Resources:  │  │
│ │ 256Mi-1Gi   │ 256Mi-1Gi   │ 256Mi-1Gi   │ 256Mi-1Gi   │  │
│ │ 100m-500m   │ 100m-500m   │ 100m-500m   │ 100m-500m   │  │
│ │ Health ✓    │ Health ✓    │ Health ✓    │ Health ✓    │  │
│ └─────────────┴─────────────┴─────────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ☁️ Déploiement Kubernetes

### Configuration Actuelle (Optimisée)

```bash
# Infrastructure locale avec optimisations
cd k8s/overlays/local
kubectl apply -k .

# Infrastructure production
cd k8s/overlays/prod
kubectl apply -k .
```

### Features Kubernetes Implémentées

- ✅ **Horizontal Pod Autoscaler** - Scaling automatique 2-10 replicas
- ✅ **Ingress Controller** - Load balancing + rate limiting
- ✅ **Health Checks** - Triple probing (liveness, readiness, startup)
- ✅ **Resource Management** - Limits intelligentes (256Mi-1Gi)
- ✅ **CI/CD Optimisé** - GitHub Actions + GHCR + Kustomize

### Monitoring & Observability

```yaml
Métriques Disponibles:
  - HPA scaling events
  - Resource utilization (CPU/Memory)
  - Health check status
  - Request rate & latency
  - Pod lifecycle events

Commands Utiles:
  kubectl get hpa -n goofeat -w          # Monitoring scaling
  kubectl top pods -n goofeat            # Resource usage
  kubectl logs -f deployment/goofeat-back -n goofeat
```

---

## 🏗️ Architecture Applicative

```
Goofeat-Back/
├── 🍽️ app/                    # Backend NestJS API
│   ├── src/
│   │   ├── auth/              # JWT, OAuth (Google, Apple)
│   │   ├── users/             # Gestion utilisateurs
│   │   ├── recipes/           # CRUD recettes + search Elasticsearch
│   │   ├── stocks/            # Inventaire utilisateur avec DLC
│   │   ├── notifications/     # Push Firebase + emails
│   │   ├── households/        # Gestion foyers familiaux
│   │   └── common/
│   │       ├── elasticsearch/ # Service de recherche personnalisé
│   │       ├── units/         # Conversion d'unités intelligente
│   │       └── logger/        # Winston avec rotation
│   └── compose.yml            # Services développement
│
├── ☁️ k8s/                    # Infrastructure Kubernetes
│   ├── base/                  # Ressources de base
│   │   ├── deployment.yaml    # Pods avec health checks
│   │   ├── service.yaml       # Service ClusterIP
│   │   ├── hpa.yaml          # Auto-scaling configuration
│   │   ├── ingress.yaml      # Load balancer + TLS
│   │   └── kustomization.yaml # Base config
│   └── overlays/
│       ├── local/            # Configuration locale (NodePort)
│       └── prod/             # Configuration production
│
├── 🔧 .github/workflows/      # CI/CD Pipeline
│   ├── docker-ci.yml         # Build + Deploy automatique
│   ├── build.yml             # Tests + Quality gates
│   └── conventional-pr.yml   # PR validation
│
└── 📚 Documentation/
    ├── SEARCH_*.md            # Système de recherche avancé
    ├── OPTIMIZATIONS_KUBERNETES.md # Guide optimisations
    └── app/SETTINGS_*.md      # Configuration utilisateur
```

## 🔍 Fonctionnalités Clés

### 🥘 Recommandations Intelligentes

- **Scoring multi-critères** basé sur disponibilité + DLC (anti-gaspillage)
- **Algorithme binaire** : 100% réalisable ou score 0
- **Conversion d'unités** automatique (g/ml/piece)
- **Recherche Elasticsearch** avec analyzer français optimisé

### 📊 Performance & Scalabilité

- **Auto-scaling** : 2-10 pods selon charge CPU/Memory
- **Load balancing** : Distribution intelligente via Ingress
- **Health monitoring** : Triple probing avec recovery automatique
- **Rate limiting** : Protection DDoS (100 req/min)

### 📱 Notifications Smart

- **Alertes d'expiration** configurables par utilisateur (1-14 jours)
- **Protection anti-spam** avec historique et déduplication
- **Mode digest familial** : instantané, quotidien, hebdomadaire
- **Firebase Cloud Messaging** pour notifications push

### 👨‍👩‍👧‍👦 Gestion Multi-foyers

- **4 types de foyers** : Famille, couple, colocation, personne seule
- **Permissions différenciées** enfants/adultes
- **Approbations automatiques** avec seuils configurables

---

## 🛠️ Stack Technique

### Backend & Database

- **Backend** : NestJS 11.0.1, TypeScript 5.7.3, Node.js 22
- **Databases** : PostgreSQL (NeonDB), MongoDB, Elasticsearch 8.11.2
- **ORM** : TypeORM 0.3.24 avec migrations automatiques
- **Search** : Elasticsearch avec scoring personnalisé anti-gaspillage

### DevOps & Infrastructure

- **Containers** : Docker multi-stage optimisé
- **Orchestration** : Kubernetes avec Kustomize
- **CI/CD** : GitHub Actions + GitHub Container Registry
- **Monitoring** : Health checks + HPA metrics
- **Load Balancing** : Ingress NGINX avec SSL/TLS

### Auth & Notifications

- **Auth** : JWT + Passport, OAuth2 (Google, Apple)
- **Notifications** : Firebase Cloud Messaging
- **Email** : SMTP avec templates Handlebars
- **Security** : Rate limiting, CORS, resource limits

---

## 📈 Métriques de Performance

### Elasticsearch Innovation

```yaml
Scoring Performance:
  - Latency P95: ~95ms
  - Index: ~25k recettes
  - Multi-unités: Support g/ml/piece
  - Anti-waste: Weight 5.0 sur DLC
```

### Infrastructure Scalability

```yaml
Kubernetes Metrics:
  - Availability: 99.95% (multi-pods + health checks)
  - Auto-scaling: 2-10 replicas (CPU 70%, Memory 80%)
  - Resource efficiency: 256Mi-1Gi par pod
  - Load balancing: NGINX Ingress avec rate limiting
  - Recovery: 30s rollback automatique
```

---

## 🤝 Contribution

1. Fork le projet
2. Feature branch (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'feat: add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request

### Standards de Code

- **Conventional Commits** obligatoires
- **TypeScript strict mode** activé
- **Tests coverage** >= 80% (Jest)
- **ESLint + Prettier** configurés
- **Health checks** pour nouvelles routes

## 📄 License

MIT License - voir [LICENSE](./LICENSE) pour plus de détails
