import { z } from 'zod';
import { ProviderError, withTimeout, type FetchLike } from '../http';

const teamSchema = z.object({
  idTeam: z.string(),
  strTeam: z.string(),
  strCountry: z.string().nullable().optional(),
  strLeague: z.string().nullable().optional(),
  strBadge: z.string().nullable().optional(),
  // Campo antiguo en algunas versiones de la API.
  strTeamBadge: z.string().nullable().optional(),
});
const searchSchema = z.object({ teams: z.array(teamSchema).nullable() });
export type TheSportsDbTeam = z.infer<typeof teamSchema>;

/**
 * Cliente de TheSportsDB (proveedor secundario de escudos).
 * La clave pública "3" tiene cobertura y límites reducidos.
 */
export class TheSportsDbClient {
  private readonly base: string;
  private readonly key: string;
  private readonly fetchImpl: FetchLike;
  constructor(opts: { apiKey?: string; baseUrl?: string; fetch?: FetchLike } = {}) {
    this.key = opts.apiKey?.trim() || '3';
    this.base = (opts.baseUrl ?? 'https://www.thesportsdb.com/api/v1/json').replace(/\/$/, '');
    this.fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  }

  async searchTeams(name: string): Promise<TheSportsDbTeam[]> {
    const url = `${this.base}/${encodeURIComponent(this.key)}/searchteams.php?t=${encodeURIComponent(name)}`;
    const res = await withTimeout(10000, (signal) => this.fetchImpl(url, { signal }));
    if (!res.ok) throw new ProviderError('thesportsdb', `HTTP ${res.status}`, res.status);
    const parsed = searchSchema.safeParse(await res.json());
    if (!parsed.success) throw new ProviderError('thesportsdb', `Respuesta inesperada: ${parsed.error.message}`);
    return parsed.data.teams ?? [];
  }

  /** URL del escudo del primer equipo que coincide, o null. */
  async findBadge(name: string): Promise<{ url: string; team: TheSportsDbTeam } | null> {
    const teams = await this.searchTeams(name);
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const exact = teams.find((t) => norm(t.strTeam) === norm(name)) ?? teams[0];
    const url = exact?.strBadge || exact?.strTeamBadge;
    return exact && url ? { url, team: exact } : null;
  }
}
