import { DEFAULT_MAX_FILE_SIZE, MAX_ALLOWED_FILE_SIZE, MIN_ALLOWED_FILE_SIZE } from '../config';
import { IngestOptions } from '../types';

/** Trim, drop empties and de-duplicate a user supplied list of glob patterns. */
export function normalizePatterns(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const seen = new Set<string>();
    for (const entry of value) {
        if (typeof entry !== 'string') {
            continue;
        }
        const trimmed = entry.trim();
        if (trimmed !== '') {
            seen.add(trimmed);
        }
    }

    return [...seen];
}

/** Clamp a configured file-size limit into a sane byte range, falling back to the default. */
export function normalizeMaxFileSize(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return DEFAULT_MAX_FILE_SIZE;
    }

    const rounded = Math.floor(value);
    if (rounded < MIN_ALLOWED_FILE_SIZE) {
        return MIN_ALLOWED_FILE_SIZE;
    }

    return Math.min(rounded, MAX_ALLOWED_FILE_SIZE);
}

export function normalizeIngestOptions(options: Partial<IngestOptions> | undefined): IngestOptions {
    return {
        includePatterns: normalizePatterns(options?.includePatterns),
        excludePatterns: normalizePatterns(options?.excludePatterns),
        maxFileSize: normalizeMaxFileSize(options?.maxFileSize),
    };
}

/**
 * Serialize options for `gitingest-script.py`. Empty pattern lists are omitted so the
 * script keeps the package defaults (notably: no include filter at all).
 */
export function serializeIngestOptions(options: IngestOptions): string {
    const payload: Record<string, unknown> = { max_file_size: options.maxFileSize };

    if (options.includePatterns.length > 0) {
        payload.include_patterns = options.includePatterns;
    }
    if (options.excludePatterns.length > 0) {
        payload.exclude_patterns = options.excludePatterns;
    }

    return JSON.stringify(payload);
}
