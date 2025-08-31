import { Unit } from 'src/common/units/unit.enums';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';

/**
 * Interface pour les services de récupération de données produits
 * Cette interface permet d'abstraire la source de données (OpenFoodFacts, autre API, etc.)
 */
export interface ProductDataService {
  /**
   * Récupère les informations d'un produit par son code-barres
   * @param barcode Code-barres du produit
   */
  getProductByBarcode(barcode: string): Promise<ProductData>;

  /**
   * Recherche des produits par nom
   * @param name Nom du produit à rechercher
   * @param limit Nombre maximum de résultats
   */
  searchProductsByName(name: string, limit?: number): Promise<ProductData[]>;
}

/**
 * Structure de données pour les informations produits
 */
export interface ProductData {
  id?: string;
  barcode?: string;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  packagingSize: number;
  defaultUnit: Unit;
  ingredients: Ingredient[];
  // Taxonomie OpenFoodFacts pour le matching avec les ingrédients
  categories?: string[];
  categoriesHierarchy?: string[];
  // Autres
  [key: string]: any; // Propriétés supplémentaires spécifiques à chaque API
}
