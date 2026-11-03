import type { Catalog, Club, PlayerVersion } from '@fu/domain';

/**
 * Contrato de acceso al catálogo. La implementación en memoria sirve al
 * cliente y a los tests; apps/server puede aportar una implementación sobre
 * PostgreSQL (ver sql/001_init.sql) sin cambiar el dominio.
 */
export interface CatalogRepository {
  getClub(id: string): Promise<Club | null>;
  listClubs(): Promise<Club[]>;
  listVersions(filter?: { rarity?: string; minRating?: number }): Promise<PlayerVersion[]>;
  /** Actualiza el ID de API-Football de un club tras una sincronización. */
  setClubApiFootballId(clubId: string, apiFootballId: number | null): Promise<void>;
}

export class InMemoryCatalogRepository implements CatalogRepository {
  private overrides = new Map<string, number | null>();
  constructor(private readonly catalog: Catalog) {}

  async getClub(id: string) {
    const club = this.catalog.clubs.get(id);
    if (!club) return null;
    return this.overrides.has(id) ? { ...club, apiFootballId: this.overrides.get(id)! } : club;
  }
  async listClubs() {
    return Promise.all([...this.catalog.clubs.keys()].map((id) => this.getClub(id))).then((x) => x.filter((c): c is Club => !!c));
  }
  async listVersions(filter: { rarity?: string; minRating?: number } = {}) {
    return [...this.catalog.versions.values()].filter(
      (v) => (!filter.rarity || v.rarity === filter.rarity) && (!filter.minRating || v.rating >= filter.minRating),
    );
  }
  async setClubApiFootballId(clubId: string, apiFootballId: number | null) {
    this.overrides.set(clubId, apiFootballId);
  }
}
