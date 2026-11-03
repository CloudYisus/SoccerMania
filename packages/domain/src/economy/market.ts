import type { Rng } from '@fu/shared';

/** Impuesto clásico sobre ventas en el mercado. */
export const MARKET_TAX = 0.05;

/** Valor de referencia de una carta según su valoración (economía del juego, no precios reales). */
export function marketValue(rating: number): number {
  return roundPrice(260 * Math.pow(1.36, Math.max(0, rating - 70)));
}

/** Redondeo a los escalones de precio clásicos. */
export function roundPrice(v: number): number {
  const step = v < 1000 ? 50 : v < 10000 ? 100 : v < 50000 ? 250 : v < 100000 ? 500 : 1000;
  return Math.max(150, Math.round(v / step) * step);
}

export interface PriceRange {
  min: number;
  max: number;
}

export function priceRange(rating: number): PriceRange {
  const v = marketValue(rating);
  return { min: roundPrice(v * 0.6), max: roundPrice(v * 2.5) };
}

export function quickSellValue(rating: number): number {
  return Math.max(50, Math.round((marketValue(rating) * 0.08) / 10) * 10);
}

export function afterTax(price: number): number {
  return Math.floor(price * (1 - MARKET_TAX));
}

/**
 * Probabilidad de que un comprador IA acepte un precio de venta.
 * Cerca del valor de mercado ≈ 75 %; muy por encima cae rápido.
 */
export function saleProbability(price: number, value: number): number {
  const ratio = price / value;
  if (ratio <= 0.85) return 0.97;
  return Math.max(0.03, Math.min(0.97, 0.75 - (ratio - 1) * 1.4));
}

export function resolveSale(rng: Rng, price: number, value: number): boolean {
  return rng.chance(saleProbability(price, value));
}

export interface Wallet {
  coins: number;
}

export function canAfford(wallet: Wallet, price: number): boolean {
  return wallet.coins >= price;
}
