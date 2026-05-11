import fileEntryCache from 'file-entry-cache';

let cacheInstance: ReturnType<typeof fileEntryCache.create> | null = null;

/**
 * Creates a file entry cache instance
 * @param cacheName The name of the cache file
 * @returns Cache instance
 */
export function createCache(
  cacheName: string = 'component-tagger',
): ReturnType<typeof fileEntryCache.create> {
  if (!cacheInstance) {
    cacheInstance = fileEntryCache.create(cacheName);
  }
  return cacheInstance;
}

/**
 * Checks if a file should be processed based on cache
 * @param id The file path/ID
 * @param cache The cache instance
 * @returns Boolean indicating if file changed and should be processed
 */
export function shouldProcessFile(
  id: string,
  cache: ReturnType<typeof fileEntryCache.create>,
): boolean {
  const fileDescriptor = cache.getFileDescriptor(id);
  return fileDescriptor.changed || !fileDescriptor.meta;
}

/**
 * Marks a file as processed in the cache
 * @param id The file path/ID
 * @param cache The cache instance
 */
export function markFileProcessed(
  id: string,
  cache: ReturnType<typeof fileEntryCache.create>,
): void {
  // The cache automatically tracks files when getFileDescriptor is called
  // This function is mainly for clarity/documentation
  cache.getFileDescriptor(id);
}

/**
 * Reconciles and saves the cache state
 * @param cache The cache instance
 */
export function reconcileCache(
  cache: ReturnType<typeof fileEntryCache.create>,
): void {
  cache.reconcile();
}
