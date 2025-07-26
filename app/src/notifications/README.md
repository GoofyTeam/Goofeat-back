# Système de Notifications FCM

Ce module implémente un système de notifications Firebase Cloud Messaging (FCM) pour alerter les utilisateurs lorsque leurs aliments expirent dans moins de 3 jours.

## Fonctionnalités

### 🔔 Notifications automatiques
- **Vérification quotidienne** : Tâche planifiée qui s'exécute tous les jours à 9h00
- **Seuil d'alerte** : Notification envoyée 3 jours avant expiration
- **Notifications groupées** : Les produits du même utilisateur sont regroupés dans une seule notification

### 📱 Gestion des tokens FCM
- **Enregistrement** : API pour enregistrer le token FCM de l'utilisateur
- **Suppression** : API pour supprimer le token FCM
- **Validation** : Gestion automatique des tokens invalides

### 🎯 Événements en temps réel
- **Création de stock** : Vérification immédiate si le produit expire bientôt
- **Mise à jour de stock** : Re-vérification si la DLC a changé
- **Suppression de stock** : Nettoyage des événements liés

## Configuration

### Variables d'environnement

Ajoutez ces variables à votre fichier `.env` :

```bash
# Configuration Firebase Cloud Messaging
FIREBASE_PROJECT_ID=votre_project_id_firebase
FIREBASE_SERVICE_ACCOUNT_PATH=/chemin/vers/votre/service-account-key.json
```

### Fichier de configuration Firebase

1. Créez un projet Firebase sur [console.firebase.google.com](https://console.firebase.google.com)
2. Activez Firebase Cloud Messaging
3. Générez une clé de compte de service :
   - Allez dans Paramètres du projet > Comptes de service
   - Cliquez sur "Générer une nouvelle clé privée"
   - Téléchargez le fichier JSON
   - Placez-le dans votre projet et mettez à jour `FIREBASE_SERVICE_ACCOUNT_PATH`

## API Endpoints

### POST `/notifications/fcm-token`
Enregistre ou met à jour le token FCM de l'utilisateur.

```json
{
  "fcmToken": "token_fcm_de_l_appareil"
}
```

### POST `/notifications/fcm-token/remove`
Supprime le token FCM de l'utilisateur.

### GET `/notifications/expiration-stats`
Récupère les statistiques d'expiration pour l'utilisateur connecté.

```json
{
  "expiringSoon": 5,
  "expiredToday": 2,
  "totalExpiring": [...]
}
```

### POST `/notifications/test-expiration-check`
Déclenche manuellement la vérification des expirations (utile pour les tests).

## Architecture

### Services

- **NotificationService** : Gestion de l'envoi des notifications FCM
- **ExpirationCheckService** : Vérification périodique des expirations
- **FirebaseConfig** : Configuration et initialisation de Firebase

### Événements

- **StockCreatedEvent** : Émis lors de la création d'un stock
- **StockUpdatedEvent** : Émis lors de la mise à jour d'un stock
- **StockDeletedEvent** : Émis lors de la suppression d'un stock
- **StockExpirationWarningEvent** : Émis pour les alertes d'expiration

### Listeners

- **StockListener** : Écoute les événements de stock et déclenche les notifications

## Utilisation côté client

### Enregistrement du token FCM

```typescript
// Dans votre application mobile/web
import { getMessaging, getToken } from 'firebase/messaging';

const messaging = getMessaging();
const token = await getToken(messaging, {
  vapidKey: 'votre_vapid_key'
});

// Envoyer le token au backend
await fetch('/notifications/fcm-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({ fcmToken: token })
});
```

### Réception des notifications

```typescript
// Écouter les notifications
onMessage(messaging, (payload) => {
  console.log('Notification reçue:', payload);
  
  // Afficher la notification
  if (payload.notification) {
    new Notification(payload.notification.title, {
      body: payload.notification.body,
      icon: '/icon.png'
    });
  }
});
```

## Tests

### Test manuel de la vérification d'expiration

```bash
curl -X POST http://localhost:3000/notifications/test-expiration-check \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Vérifier les statistiques d'expiration

```bash
curl -X GET http://localhost:3000/notifications/expiration-stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Logs et Monitoring

Le système génère des logs détaillés pour :
- Envoi de notifications (succès/échec)
- Tokens FCM invalides
- Erreurs de configuration Firebase
- Statistiques des vérifications d'expiration

## Sécurité

- Les tokens FCM sont stockés de manière sécurisée dans la base de données
- Seuls les utilisateurs authentifiés peuvent gérer leurs tokens
- Les notifications ne contiennent pas d'informations sensibles
- Gestion automatique des tokens expirés ou invalides

## Dépannage

### Firebase n'est pas configuré
```
Firebase configuration manquante. Les notifications FCM ne seront pas disponibles.
```
→ Vérifiez vos variables d'environnement `FIREBASE_PROJECT_ID` et `FIREBASE_SERVICE_ACCOUNT_PATH`

### Token FCM invalide
```
Token FCM invalide pour l'utilisateur xxx
```
→ Le token sera automatiquement supprimé. L'utilisateur doit se reconnecter pour obtenir un nouveau token.

### Erreur d'envoi de notification
```
Erreur lors de l'envoi de la notification: [details]
```
→ Vérifiez la configuration Firebase et la validité du token FCM.
