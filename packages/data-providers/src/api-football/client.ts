import { z } from 'zod';
import { ProviderError, withTimeout, type FetchLike } from '../http';
import { countrySchema, envelopeSchema, teamItemSchema } from './schemas';

export interface ApiFootballOptions {
  apiKey: string | undefined;
  baseUrl?: string;
  mediaUrl?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
}

export interface TeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
  country?: string;
  code?: string;
  search?: string;
}

/**
 * Cliente de API-Football v3 (API-Sports).
 * - Autenticación con cabecera `x-apisports-key` (sólo en el servidor).
 * - Las URLs de media (escudos/banderas/logos) no consumen cuota de la API.
 */
export class ApiFootballClient {
  readonly baseUrl: string;
  readonly mediaUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  /** Última información de cuota recibida en cabeceras. */
  rateLimit: { remainingDaily: number | null; remainingMinute: number | null } = { remainingDaily: null, remainingMinute: null };

  constructor(opts: ApiFootballOptions) {
    this.apiKey = opts.apiKey?.trim() || undefined;
    this.baseUrl = (opts.baseUrl ?? 'https://v3.football.api-sports.io').replace(/\/$/, '');
    this.mediaUrl = (opts.mediaUrl ?? 'https://media.api-sports.io').replace(/\/$/, '');
    this.fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.timeoutMs = opts.timeoutMs ?? 12000;
  }

  get configured(): boolean {
    return !!this.apiKey;
  }

  teamLogoUrl(teamId: number) {
    return `${this.mediaUrl}/football/teams/${teamId}.png`;
  }
  leagueLogoUrl(leagueId: number) {
    return `${this.mediaUrl}/football/leagues/${leagueId}.png`;
  }
  playerPhotoUrl(playerId: number) {
    return `${this.mediaUrl}/football/players/${playerId}.png`;
  }
  /** Bandera SVG por código de país (minúsculas, p. ej. "br", "gb-eng"). */
  flagUrl(code: string) {
    return `${this.mediaUrl}/flags/${code.toLowerCase()}.svg`;
  }

  private async request<T extends z.ZodTypeAny>(path: string, params: Record<string, string | number | undefined>, item: T) {
    if (!this.apiKey) throw new ProviderError('api-football', 'APISPORTS_KEY no configurada');
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
    const url = `${this.baseUrl}${path}${qs.size ? `?${qs}` : ''}`;
    const res = await withTimeout(this.timeoutMs, (signal) =>
      this.fetchImpl(url, { headers: { 'x-apisports-key': this.apiKey! }, signal }),
    );
    const num = (h: string) => {
      const v = res.headers.get(h);
      return v === null ? null : Number(v);
    };
    this.rateLimit = {
      remainingDaily: num('x-ratelimit-requests-remaining'),
      remainingMinute: num('x-ratelimit-remaining'),
    };
    if (!res.ok) throw new ProviderError('api-football', `HTTP ${res.status} en ${path}`, res.status);
    const parsed = envelopeSchema(item).safeParse(await res.json());
    if (!parsed.success) throw new ProviderError('api-football', `Respuesta inesperada en ${path}: ${parsed.error.message}`);
    const errors = parsed.data.errors;
    const hasErrors = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0;
    if (hasErrors) throw new ProviderError('api-football', `Error de la API: ${JSON.stringify(errors)}`);
    return parsed.data.response as z.infer<T>[];
  }

  /** GET /countries */
  getCountries(params: { name?: string; code?: string; search?: string } = {}) {
    return this.request('/countries', params, countrySchema);
  }

  /** GET /teams */
  getTeams(query: TeamsQuery) {
    return this.request('/teams', { ...query }, teamItemSchema);
  }

  /** Busca equipos por nombre (mínimo 3 caracteres según la API). */
  searchTeams(term: string) {
    if (term.trim().length < 3) throw new ProviderError('api-football', 'La búsqueda requiere al menos 3 caracteres');
    return this.getTeams({ search: term.trim() });
  }
}
