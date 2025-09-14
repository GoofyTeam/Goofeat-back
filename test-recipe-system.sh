#!/bin/bash

# Script de test pour le système de recommandation de recettes
# Ce script crée un utilisateur, des produits et du stock pour tester les recommandations

# Configuration
BASE_URL="http://localhost:3000/api/v1"
TEST_USER_EMAIL="test.recipe@goofeat.com"
TEST_USER_PASSWORD="TestRecipe123!"
TEST_USER_NAME="Recipe Tester"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de log
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Fonction pour faire des requêtes avec gestion d'erreur
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth_header=$4
    
    if [ -n "$auth_header" ]; then
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $auth_header" \
            -H "Content-Type: application/json" \
            ${data:+-d "$data"}
    else
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            ${data:+-d "$data"}
    fi
}

# Étape 1: Créer ou récupérer le token utilisateur
log "🔐 Authentification de l'utilisateur de test..."

# Essayer de se connecter
AUTH_RESPONSE=$(api_call "POST" "/auth/login" "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}")

if echo "$AUTH_RESPONSE" | jq -e '.accessToken' > /dev/null 2>&1; then
    TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.accessToken')
    success "Connexion réussie"
else
    warn "Utilisateur non trouvé, création en cours..."
    
    # Créer l'utilisateur
    REGISTER_RESPONSE=$(api_call "POST" "/auth/register" "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\",\"name\":\"$TEST_USER_NAME\"}")
    
    if echo "$REGISTER_RESPONSE" | jq -e '.accessToken' > /dev/null 2>&1; then
        TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken')
        success "Utilisateur créé et connecté"
    else
        error "Échec de création de l'utilisateur: $REGISTER_RESPONSE"
        exit 1
    fi
fi

log "Token: ${TOKEN:0:20}..."

# Étape 2: Récupérer les ingrédients disponibles pour créer des produits pertinents
log "📋 Récupération des ingrédients disponibles..."

INGREDIENTS_RESPONSE=$(api_call "GET" "/ingredients?limit=100")
COMMON_INGREDIENTS=(
    "en:chicken"
    "en:beef" 
    "en:rice"
    "en:pasta"
    "en:tomato"
    "en:onion"
    "en:garlic"
    "en:cheese"
    "en:egg"
    "en:bread"
    "en:olive-oil"
    "en:salt"
    "en:pepper"
)

# Trouver les IDs des ingrédients communs
declare -A INGREDIENT_IDS
for ingredient_tag in "${COMMON_INGREDIENTS[@]}"; do
    INGREDIENT_ID=$(echo "$INGREDIENTS_RESPONSE" | jq -r ".[] | select(.parentOffTags[]? == \"$ingredient_tag\") | .id" | head -1)
    if [ "$INGREDIENT_ID" != "null" ] && [ -n "$INGREDIENT_ID" ]; then
        INGREDIENT_IDS[$ingredient_tag]=$INGREDIENT_ID
        success "Ingrédient trouvé: $ingredient_tag -> $INGREDIENT_ID"
    else
        warn "Ingrédient non trouvé: $ingredient_tag"
    fi
done

# Étape 3: Créer des produits avec les ingrédients
log "🍎 Création des produits pour les tests..."

PRODUCTS_TO_CREATE=(
    "Blanc de poulet:kg:1000:3 days:en:chicken"
    "Bœuf haché:kg:1000:2 days:en:beef"
    "Riz basmati:kg:1000:365 days:en:rice"
    "Pâtes penne:g:500:730 days:en:pasta"
    "Tomates fraîches:kg:1000:7 days:en:tomato"
    "Oignons:piece:150:30 days:en:onion"
    "Ail:piece:5:21 days:en:garlic"
    "Fromage râpé:g:200:30 days:en:cheese"
    "Œufs:piece:60:21 days:en:egg"
    "Pain de mie:g:500:7 days:en:bread"
    "Huile d'olive:ml:500:730 days:en:olive-oil"
    "Sel:g:1000:3650 days:en:salt"
    "Poivre:g:100:365 days:en:pepper"
)

declare -A PRODUCT_IDS

for product_info in "${PRODUCTS_TO_CREATE[@]}"; do
    IFS=':' read -r name unit unit_size dlc_time ingredient_tag <<< "$product_info"
    
    ingredient_id=${INGREDIENT_IDS[$ingredient_tag]}
    
    if [ -z "$ingredient_id" ] || [ "$ingredient_id" == "null" ]; then
        warn "Pas d'ingrédient trouvé pour $ingredient_tag, création sans ingrédient"
        PRODUCT_DATA="{\"name\":\"$name\",\"defaultUnit\":\"$unit\",\"unitSize\":$unit_size,\"defaultDlcTime\":\"$dlc_time\"}"
    else
        PRODUCT_DATA="{\"name\":\"$name\",\"defaultUnit\":\"$unit\",\"unitSize\":$unit_size,\"defaultDlcTime\":\"$dlc_time\",\"ingredients\":[\"$ingredient_id\"]}"
    fi
    
    log "Création du produit: $name"
    PRODUCT_RESPONSE=$(api_call "POST" "/product" "$PRODUCT_DATA" "$TOKEN")
    
    PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | jq -r '.id')
    if [ "$PRODUCT_ID" != "null" ] && [ -n "$PRODUCT_ID" ]; then
        PRODUCT_IDS[$name]=$PRODUCT_ID
        success "Produit créé: $name -> $PRODUCT_ID"
    else
        error "Échec création produit $name: $PRODUCT_RESPONSE"
    fi
done

# Étape 4: Ajouter les produits au stock en bulk
log "📦 Ajout des produits au stock..."

STOCK_DATA="["
first=true

for product_name in "${!PRODUCT_IDS[@]}"; do
    product_id=${PRODUCT_IDS[$product_name]}
    
    # Quantités différentes selon le type de produit
    case $product_name in
        *"poulet"*|*"bœuf"*) quantity=1.5 ;;
        *"riz"*|*"pâtes"*) quantity=2 ;;
        *"tomates"*) quantity=1 ;;
        *"oignons"*) quantity=5 ;;
        *"ail"*) quantity=3 ;;
        *"fromage"*) quantity=200 ;;
        *"œufs"*) quantity=12 ;;
        *"pain"*) quantity=1 ;;
        *"huile"*) quantity=500 ;;
        *"sel"*) quantity=1000 ;;
        *"poivre"*) quantity=50 ;;
        *) quantity=1 ;;
    esac
    
    if [ "$first" = true ]; then
        first=false
    else
        STOCK_DATA="$STOCK_DATA,"
    fi
    
    # Ajouter DLC pour les produits périssables
    case $product_name in
        *"poulet"*|*"bœuf"*|*"tomates"*)
            dlc_date=$(date -d "+5 days" "+%Y-%m-%d")
            STOCK_DATA="$STOCK_DATA{\"productId\":\"$product_id\",\"quantity\":$quantity,\"dlc\":\"${dlc_date}T00:00:00.000Z\"}"
            ;;
        *)
            STOCK_DATA="$STOCK_DATA{\"productId\":\"$product_id\",\"quantity\":$quantity}"
            ;;
    esac
done

STOCK_DATA="$STOCK_DATA]"

log "Envoi des données de stock..."
STOCK_RESPONSE=$(api_call "POST" "/stock/bulk" "$STOCK_DATA" "$TOKEN")

if echo "$STOCK_RESPONSE" | jq -e '.[0].id' > /dev/null 2>&1; then
    STOCK_COUNT=$(echo "$STOCK_RESPONSE" | jq '. | length')
    success "Stock créé avec succès: $STOCK_COUNT produits ajoutés"
else
    error "Échec création du stock: $STOCK_RESPONSE"
    exit 1
fi

# Étape 5: Tester les recommandations de recettes
log "🍳 Test des recommandations de recettes..."

sleep 2  # Attendre la synchronisation Elasticsearch

RECIPES_RESPONSE=$(api_call "GET" "/recipes/search?userId=$(echo $AUTH_RESPONSE | jq -r '.user.id // empty')&limit=10" "" "$TOKEN")

if echo "$RECIPES_RESPONSE" | jq -e '.data[0]' > /dev/null 2>&1; then
    RECIPE_COUNT=$(echo "$RECIPES_RESPONSE" | jq '.data | length')
    success "Recommandations trouvées: $RECIPE_COUNT recettes"
    
    # Afficher les 3 premières recettes recommandées
    log "📋 Top 3 des recettes recommandées:"
    echo "$RECIPES_RESPONSE" | jq -r '.data[0:3] | .[] | "  • \(.name) (Score: \(.completenessScore // "N/A")%)"'
else
    warn "Aucune recommandation trouvée ou erreur: $RECIPES_RESPONSE"
fi

# Étape 6: Vérifier le stock créé
log "📊 Vérification du stock créé..."
USER_STOCK=$(api_call "GET" "/stock" "" "$TOKEN")

if echo "$USER_STOCK" | jq -e '.data[0]' > /dev/null 2>&1; then
    STOCK_ITEMS_COUNT=$(echo "$USER_STOCK" | jq '.data | length')
    success "Stock vérifié: $STOCK_ITEMS_COUNT articles en stock"
    
    # Afficher le stock
    log "📦 Articles en stock:"
    echo "$USER_STOCK" | jq -r '.data[] | "  • \(.product.name): \(.quantity) \(.unit // "unité(s)")"'
else
    error "Échec vérification du stock: $USER_STOCK"
fi

success "🎉 Test terminé avec succès!"
log "Utilisateur de test: $TEST_USER_EMAIL"
log "Token: ${TOKEN:0:20}..."
log "Vous pouvez maintenant utiliser ce token pour tester manuellement l'API"