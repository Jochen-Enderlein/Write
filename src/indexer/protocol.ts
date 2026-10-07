import type { IndexStatus } from '@shared/types'

export type IndexCommand =
  | { type: 'open'; root: string; dbFile: string }
  | { type: 'sync' }
  | { type: 'rebuild' }
  | { type: 'changed'; paths: string[] }
  | { type: 'deleted'; paths: string[] }
  | { type: 'query'; id: number; name: QueryName; args: unknown[] }

export type QueryName =
  | 'titles'
  | 'search'
  | 'backlinks'
  | 'mentions'
  | 'tags'
  | 'graph'
  | 'tagPaths'
  | 'resolve'
  | 'linkSources'
  | 'summaries'
  | 'status'

export type IndexMessage =
  | { type: 'result'; id: number; result?: unknown; error?: string }
  | { type: 'status'; status: IndexStatus }
  | { type: 'updated' }
