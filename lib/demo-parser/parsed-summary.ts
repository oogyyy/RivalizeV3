import type { DemoHeader, PlayerStats } from '@/types/database'

/**
 * Slim projection of `demos.parsed_data` for list / summary views.
 *
 * The full column is ~128 KB on the wire per demo, of which `rounds[]`
 * (per-round kills with world coords) is ~124 KB — data that list and
 * dashboard views never read. Selecting only the sub-keys they DO use
 * (header ~180 B, players ~4 KB, opponentSide) cuts each row by ~97%,
 * keeping the heavy arrays inside Postgres instead of egressing them.
 *
 * Detail pages (e.g. /my-team/demos/[id]) still `select('*')` for the
 * full parse; only list/aggregation queries should use this projection.
 *
 * PostgREST JSON-path projection with aliases — see
 * https://postgrest.org/en/stable/references/api/resource_representation.html
 */
export const PARSED_SUMMARY_SELECT =
  'header:parsed_data->header,players:parsed_data->players,opponentSide:parsed_data->>opponentSide'

/** Shape returned when a row is selected with {@link PARSED_SUMMARY_SELECT}. */
export interface ParsedSummaryRow {
  header?: unknown
  players?: unknown
  opponentSide?: unknown
}

export type ParsedSummary = {
  header?: DemoHeader
  players?: PlayerStats[]
  opponentSide?: 'team1' | 'team2'
} | null

/**
 * Folds a projected row's `header` / `players` / `opponentSide` aliases back
 * into a `parsed_data`-shaped object, so existing consumers that read
 * `demo.parsed_data.{header,players,opponentSide}` keep working unchanged.
 */
export function summaryToParsedData(row: ParsedSummaryRow): ParsedSummary {
  if (row.header == null && row.players == null && row.opponentSide == null) return null
  return {
    header: (row.header as DemoHeader | null) ?? undefined,
    players: (row.players as PlayerStats[] | null) ?? undefined,
    opponentSide: (row.opponentSide as 'team1' | 'team2' | null) ?? undefined,
  }
}
