import { Injectable } from '@nestjs/common';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Product } from 'src/products/entities/product.entity';

export interface DlcPrediction {
  days: number;
  source: 'ingredient' | 'category' | 'product' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

@Injectable()
export class DlcRulesService {
  private readonly OFF_CATEGORY_RULES: Record<string, number> = {
    // Taxonomie OpenFoodFacts
    'en:fruits': 7,
    'en:vegetables': 7,
    'en:citrus-fruits': 14,
    'en:stone-fruits': 5,
    'en:root-vegetables': 21,
    'en:leafy-vegetables': 3,

    // Produits laitiers
    'en:dairy': 7,
    'en:fermented-dairy-products': 14,
    'en:yogurts': 21,
    'en:cheeses': 30,
    'en:milk': 5,

    // Viandes et poissons
    'en:meat': 3,
    'en:poultry': 3,
    'en:fish': 2,
    'en:processed-meat': 7,

    // Produits secs
    'en:cereals': 365,
    'en:legumes': 365,
    'en:spices': 730,

    // Conserves
    'en:canned-foods': 1095, // 3 ans
    'en:frozen-foods': 180, // 6 mois

    // Condiments
    'en:condiments': 90,
    'en:fats': 365,
    'en:vinegars': 730,
  };

  private readonly INGREDIENT_RULES: Record<string, number> = {
    // Fruits spécifiques
    pommes: 14,
    bananes: 7,
    avocat: 5,
    citron: 21,
    orange: 14,

    // Légumes spécifiques
    carottes: 21,
    'pommes de terre': 30,
    oignons: 60,
    ail: 90,
    tomates: 7,
    salade: 5,
    épinards: 3,

    // Produits laitiers spécifiques
    yaourt: 21,
    lait: 5,
    'crème fraîche': 14,
    beurre: 30,
    'fromage blanc': 14,
    mozzarella: 7,
    gruyère: 60,

    // Viandes spécifiques
    boeuf: 3,
    porc: 3,
    agneau: 3,
    'poisson blanc': 2,
    saumon: 2,
    crevettes: 1,
    jambon: 7,

    // Œufs
    œufs: 28,

    // Pain et viennoiseries
    pain: 3,
    baguette: 1,
    croissants: 2,
  };

  /**
   * Prédit la DLC par défaut pour un produit basé sur ses ingrédients
   */
  predictDefaultDlc(product: Product): DlcPrediction {
    // 1. Si le produit a une DLC explicite, l'utiliser
    if (product.defaultDlcTime) {
      return this.parseDlcTime(product.defaultDlcTime, 'product', 'high');
    }

    // 2. Chercher parmi les ingrédients principaux
    if (product.ingredients?.length > 0) {
      const ingredientPredictions = product.ingredients
        .map((ingredient) => this.predictFromIngredient(ingredient))
        .filter((pred) => pred !== null);

      if (ingredientPredictions.length > 0) {
        // Prendre la DLC la plus courte (sécurité alimentaire)
        const shortestDlc = Math.min(
          ...ingredientPredictions.map((p) => p.days),
        );
        return {
          days: shortestDlc,
          source: 'ingredient',
          confidence: 'high',
        };
      }
    }

    // 3. Fallback sur une durée par défaut sécuritaire
    return {
      days: 7, // 1 semaine par défaut pour la sécurité
      source: 'default',
      confidence: 'low',
    };
  }

  /**
   * Prédit la DLC pour un ingrédient spécifique
   */
  private predictFromIngredient(ingredient: Ingredient): DlcPrediction | null {
    // 1. DLC explicite sur l'ingrédient
    if (ingredient.defaultDlcTime) {
      return this.parseDlcTime(ingredient.defaultDlcTime, 'ingredient', 'high');
    }

    const ingredientName = ingredient.name.toLowerCase();

    // 2. Règles spécifiques par ingrédient
    for (const [pattern, days] of Object.entries(this.INGREDIENT_RULES)) {
      if (ingredientName.includes(pattern)) {
        return {
          days,
          source: 'ingredient',
          confidence: 'high',
        };
      }
    }

    // 3. Règles par taxonomie OpenFoodFacts
    if (ingredient.parentOffTags && ingredient.parentOffTags.length > 0) {
      for (const offTag of ingredient.parentOffTags) {
        if (this.OFF_CATEGORY_RULES[offTag]) {
          return {
            days: this.OFF_CATEGORY_RULES[offTag],
            source: 'category',
            confidence: 'high',
          };
        }
      }
    }

    return null;
  }

  /**
   * Parse une durée de type "7 days", "2 weeks", etc.
   */
  private parseDlcTime(
    dlcTime: string,
    source: DlcPrediction['source'],
    confidence: DlcPrediction['confidence'],
  ): DlcPrediction {
    // Vérifier que dlcTime est une string valide
    if (typeof dlcTime !== 'string' || !dlcTime) {
      return { days: 7, source, confidence: 'low' };
    }

    const matches = dlcTime.match(/(\d+)\s*(days?|weeks?|months?|years?)/i);

    if (!matches) {
      return { days: 7, source, confidence: 'low' };
    }

    const [, numberStr, unit] = matches;
    const number = parseInt(numberStr, 10);

    let days: number;
    switch (unit.toLowerCase()) {
      case 'day':
      case 'days':
        days = number;
        break;
      case 'week':
      case 'weeks':
        days = number * 7;
        break;
      case 'month':
      case 'months':
        days = number * 30;
        break;
      case 'year':
      case 'years':
        days = number * 365;
        break;
      default:
        days = number; // Fallback en jours
    }

    return { days, source, confidence };
  }

  /**
   * Obtient une suggestion de DLC pour l'affichage dans l'UI
   */
  getDlcSuggestion(product: Product): {
    suggestedDate: Date;
    explanation: string;
    confidence: string;
  } {
    const prediction = this.predictDefaultDlc(product);
    const suggestedDate = new Date();
    suggestedDate.setDate(suggestedDate.getDate() + prediction.days);

    let explanation: string;
    switch (prediction.source) {
      case 'product':
        explanation = `Basé sur la DLC définie pour ce produit (${prediction.days} jours)`;
        break;
      case 'ingredient':
        explanation = `Basé sur l'ingrédient principal (${prediction.days} jours)`;
        break;
      case 'category':
        explanation = `Basé sur la catégorie du produit (${prediction.days} jours)`;
        break;
      default:
        explanation = `Suggestion par défaut (${prediction.days} jours)`;
    }

    return {
      suggestedDate,
      explanation,
      confidence: prediction.confidence,
    };
  }
}
