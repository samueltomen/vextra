import { useQuery } from '@tanstack/react-query'

import { listFolders } from '../api/workspace-api.ts'

export const FOLDERS_QUERY_KEY = ['folders'] as const

/** `all`, `none` (no folder) or a folder id. */
export type FolderFilter = string

export function matchesFolder(
  folderId: string | null,
  filter: FolderFilter,
): boolean {
  if (filter === 'all') {
    return true
  }

  return filter === 'none' ? folderId === null : folderId === filter
}

export function useFolders() {
  return useQuery({ queryFn: listFolders, queryKey: FOLDERS_QUERY_KEY })
}
