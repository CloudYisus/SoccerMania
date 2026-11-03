import type { Club, League, Player } from '@fu/domain';
import type { ApiFootballClient } from '../api-football/client';
import type { TheSportsDbClient } from '../thesportsdb/client';
import { apiFootballFlagCode, flagIconsCode, isValidFlagCode } from './flag-codes';
import type { AssetKind, AssetSource } from './types';

/**
 * Candidato de origen para un recurso. Un sub-proveedor devuelve una lista
 * ordenada por prioridad; AssetProvider los prueba en orden.
 */
export type AssetCandidate =
  | { source: AssetSource; type: 'remote'; url: () => Promise<string | null>; ext: string }
  | { source: AssetSource; type: 'local'; path: () => Promise<string | null>; contentType: string };

export interface SubProvider<E> {
  kind: AssetKind;
  entityId(entity: E): string;
  candidates(entity: E): AssetCandidate[];
}

export interface ProviderDeps {
  apiFootball: ApiFootballClient;
  theSportsDb: TheSportsDbClient | null;
  /** Localiza un fichero manual dentro del almacén. */
  manual: (dir: string, base: string, exts: string[]) => Promise<string | null>;
  /** Ruta absoluta a un SVG de flag-icons, si existe. */
  flagIconsPath?: (code: string) => Promise<string | null>;
  /** Overrides de códigos de bandera sincronizados desde /countries. */
  flagCodeOverrides?: Record<string, string>;
}

const manualCandidate = (deps: ProviderDeps, dir: string, base: string, exts: string[], contentType: string): AssetCandidate => ({
  source: 'manual',
  type: 'local',
  path: () => deps.manual(dir, base, exts),
  contentType,
});

/** Banderas: manual → API-Football → flag-icons (local) → placeholder en cliente. */
export class CountryFlagProvider implements SubProvider<string> {
  kind = 'flag' as const;
  constructor(private deps: ProviderDeps) {}
  entityId(code: string) {
    return code.toLowerCase();
  }
  candidates(code: string): AssetCandidate[] {
    if (!isValidFlagCode(code)) return [];
    const list: AssetCandidate[] = [
      manualCandidate(this.deps, 'flags/manual', code, ['svg', 'png'], 'image/svg+xml'),
      {
        source: 'api-football',
        type: 'remote',
        ext: 'svg',
        url: async () => this.deps.apiFootball.flagUrl(apiFootballFlagCode(code, this.deps.flagCodeOverrides)),
      },
    ];
    if (this.deps.flagIconsPath) {
      const fp = this.deps.flagIconsPath;
      list.push({ source: 'flag-icons', type: 'local', contentType: 'image/svg+xml', path: () => fp(flagIconsCode(code)) });
    }
    return list;
  }
}

/** Escudos: manual → API-Football (por ID de equipo) → TheSportsDB (por nombre). */
export class ClubCrestProvider implements SubProvider<Club> {
  kind = 'crest' as const;
  constructor(
    private deps: ProviderDeps,
    private idOverrides: () => Record<string, number | null> = () => ({}),
  ) {}
  entityId(club: Club) {
    return club.id;
  }
  candidates(club: Club): AssetCandidate[] {
    const list: AssetCandidate[] = [manualCandidate(this.deps, 'clubs/manual', club.id, ['png', 'svg', 'webp'], 'image/png')];
    const overrides = this.idOverrides();
    const apiId = club.id in overrides ? overrides[club.id] : club.apiFootballId;
    if (apiId) {
      list.push({ source: 'api-football', type: 'remote', ext: 'png', url: async () => this.deps.apiFootball.teamLogoUrl(apiId) });
    }
    const tsdb = this.deps.theSportsDb;
    if (tsdb && club.theSportsDbName) {
      const name = club.theSportsDbName;
      list.push({
        source: 'thesportsdb',
        type: 'remote',
        ext: 'png',
        url: async () => (await tsdb.findBadge(name))?.url ?? null,
      });
    }
    return list;
  }
}

/** Retratos: manual (PNG con transparencia recomendado) → API-Football (si hay ID de jugador). */
export class PlayerPortraitProvider implements SubProvider<Player> {
  kind = 'portrait' as const;
  constructor(private deps: ProviderDeps) {}
  entityId(p: Player) {
    return p.id;
  }
  candidates(p: Player): AssetCandidate[] {
    const list: AssetCandidate[] = [manualCandidate(this.deps, 'players/manual', p.id, ['png', 'webp'], 'image/png')];
    if (p.apiFootballId) {
      const id = p.apiFootballId;
      list.push({ source: 'api-football', type: 'remote', ext: 'png', url: async () => this.deps.apiFootball.playerPhotoUrl(id) });
    }
    return list;
  }
}

/** Logos de competición: manual → API-Football. */
export class CompetitionLogoProvider implements SubProvider<League> {
  kind = 'competition' as const;
  constructor(private deps: ProviderDeps) {}
  entityId(l: League) {
    return l.id;
  }
  candidates(l: League): AssetCandidate[] {
    const list: AssetCandidate[] = [manualCandidate(this.deps, 'competitions/manual', l.id, ['png', 'svg'], 'image/png')];
    if (l.apiFootballId) {
      const id = l.apiFootballId;
      list.push({ source: 'api-football', type: 'remote', ext: 'png', url: async () => this.deps.apiFootball.leagueLogoUrl(id) });
    }
    return list;
  }
}
