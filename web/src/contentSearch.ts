/**
 * Jeannie - Content Search Index
 * Version: 0.8.0
 *
 * Provides fast searchable access to all Bitwig content (devices, presets, samples)
 * Supports genre-based filtering, vibe tags, and MIDI range queries.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const CONTENT_FILE = path.join(os.homedir(), '.config', 'jeannie', 'content.json');

export interface ContentItem {
  index: number;
  contentType: string;
  name: string;
  deviceType?: string;
  fileType?: string;
  creator?: string;
  category?: string;
  plugin?: string;
  path?: string;
  nameTokens: string[];
  // Kontakt-specific
  library?: string;
  requiresFullKontakt?: boolean;
  kontaktVersion?: number;
  // M-Tron-specific
  collection?: string;
  cptId?: string;
  tapes?: string[];
  // Enhanced metadata
  quality?: {
    trustworthiness: number;
    professionalism: number;
    generalAppeal: number;
  };
  vibe?: string[];
  genres?: Record<string, number>;
  midi?: {
    playableRange: { low: string; high: string };
    keyswitches?: {
      range: { low: string; high: string };
      articulations: Record<string, string>;
    };
    ccMappings?: Record<number, string>;
  };
  playingModes?: {
    available: string[];
    default: string;
    switchMethod?: string;
    switchNote?: string;
    switchCC?: number;
  };
  strumBehavior?: {
    type: string;
    description: string;
  };
}

export interface ContentIndex {
  version: string;
  scanDate: string;
  bitwigVersion: string;
  scanDurationMs: number;
  contentTypes: string[];
  totals: {
    total: number;
    [key: string]: number;
  };
  content: ContentItem[];
  stats: {
    byContentType: { [key: string]: number };
    [key: string]: any;
  };
}

export interface SearchFilters {
  contentType?: string;
  creator?: string;
  category?: string;
  plugin?: string;
  // Enhanced filters
  genre?: string;           // Filter by genre suitability
  minGenreScore?: number;   // Minimum genre score (default 50)
  vibe?: string;            // Filter by vibe tag
  playingMode?: string;     // Filter by supported playing mode
  hasStrumBehavior?: boolean; // Filter for strum/pattern instruments
}

export interface SearchResult {
  item: ContentItem;
  score: number;
}

export class ContentSearchIndex {
  private index: ContentIndex | null = null;
  private tokenIndex: Map<string, Set<number>> = new Map();
  private typeIndex: Map<string, number[]> = new Map();
  private creatorIndex: Map<string, number[]> = new Map();
  private categoryIndex: Map<string, number[]> = new Map();
  // Enhanced indexes
  private genreIndex: Map<string, Map<number, number>> = new Map(); // genre -> (itemIndex -> score)
  private vibeIndex: Map<string, number[]> = new Map();
  private playingModeIndex: Map<string, number[]> = new Map();
  private strumBehaviorIndex: number[] = [];

  /**
   * Load content index from file
   */
  async loadFromFile(filePath: string = CONTENT_FILE): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`[ContentSearch] Index file not found: ${filePath}`);
        return false;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      this.index = JSON.parse(data);

      if (!this.index || !this.index.content) {
        console.error('[ContentSearch] Invalid content index format');
        return false;
      }

      this.buildSearchIndexes();

      console.log('='.repeat(60));
      console.log(`[ContentSearch] Loaded ${this.index.content.length} content items`);
      console.log(`[ContentSearch] Scan date: ${this.index.scanDate}`);
      console.log(`[ContentSearch] Content types: ${this.index.contentTypes.join(', ')}`);
      console.log('='.repeat(60));

      return true;
    } catch (error) {
      console.error('[ContentSearch] Error loading index:', error);
      return false;
    }
  }

  /**
   * Build search indexes for fast lookups
   */
  private buildSearchIndexes(): void {
    if (!this.index) return;

    // Clear existing indexes
    this.tokenIndex.clear();
    this.typeIndex.clear();
    this.creatorIndex.clear();
    this.categoryIndex.clear();
    this.genreIndex.clear();
    this.vibeIndex.clear();
    this.playingModeIndex.clear();
    this.strumBehaviorIndex = [];

    // Build indexes
    this.index.content.forEach((item, idx) => {
      // Token index (for fast text search)
      item.nameTokens.forEach(token => {
        if (!this.tokenIndex.has(token)) {
          this.tokenIndex.set(token, new Set());
        }
        this.tokenIndex.get(token)!.add(idx);
      });

      // Content type index
      if (item.contentType) {
        if (!this.typeIndex.has(item.contentType)) {
          this.typeIndex.set(item.contentType, []);
        }
        this.typeIndex.get(item.contentType)!.push(idx);
      }

      // Creator index
      if (item.creator) {
        if (!this.creatorIndex.has(item.creator)) {
          this.creatorIndex.set(item.creator, []);
        }
        this.creatorIndex.get(item.creator)!.push(idx);
      }

      // Category index
      if (item.category) {
        if (!this.categoryIndex.has(item.category)) {
          this.categoryIndex.set(item.category, []);
        }
        this.categoryIndex.get(item.category)!.push(idx);
      }

      // Genre index (with scores)
      if (item.genres) {
        for (const [genre, score] of Object.entries(item.genres)) {
          if (score > 0) {
            if (!this.genreIndex.has(genre)) {
              this.genreIndex.set(genre, new Map());
            }
            this.genreIndex.get(genre)!.set(idx, score);
          }
        }
      }

      // Vibe index
      if (item.vibe) {
        for (const vibe of item.vibe) {
          if (!this.vibeIndex.has(vibe)) {
            this.vibeIndex.set(vibe, []);
          }
          this.vibeIndex.get(vibe)!.push(idx);
        }
      }

      // Playing mode index
      if (item.playingModes?.available) {
        for (const mode of item.playingModes.available) {
          if (!this.playingModeIndex.has(mode)) {
            this.playingModeIndex.set(mode, []);
          }
          this.playingModeIndex.get(mode)!.push(idx);
        }
      }

      // Strum behavior index
      if (item.strumBehavior) {
        this.strumBehaviorIndex.push(idx);
      }
    });

    console.log(`[ContentSearch] Built indexes: ${this.tokenIndex.size} tokens, ${this.typeIndex.size} types, ${this.creatorIndex.size} creators, ${this.genreIndex.size} genres, ${this.vibeIndex.size} vibes`);
  }

  /**
   * Search content by query string
   */
  search(query: string, filters?: SearchFilters, fuzzy: boolean = false): SearchResult[] {
    if (!this.index) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    // Start with all items (or filtered subset)
    let candidateIndexes = this.applyFilters(filters);

    if (fuzzy) {
      // Fuzzy search - calculate Levenshtein distance for each item
      return this.fuzzySearch(query, candidateIndexes);
    } else {
      // Token-based AND search (all query tokens must match)
      return this.tokenSearch(queryTokens, candidateIndexes);
    }
  }

  /**
   * Token-based search (exact token matching)
   */
  private tokenSearch(queryTokens: string[], candidateIndexes: Set<number>): SearchResult[] {
    const results: SearchResult[] = [];

    // Find items that match ALL query tokens
    candidateIndexes.forEach(idx => {
      const item = this.index!.content[idx];

      // Combine tokens from name and metadata fields for richer search
      const allTokens = new Set([
        ...item.nameTokens,
        ...(item.creator ? this.tokenize(item.creator) : []),
        ...(item.category ? this.tokenize(item.category) : []),
        ...(item.collection ? this.tokenize(item.collection) : []),
        ...(item.library ? this.tokenize(item.library) : []),
        ...(item.plugin ? this.tokenize(item.plugin) : [])
      ]);

      // Check if all query tokens are present
      const matchCount = queryTokens.filter(qt => allTokens.has(qt)).length;

      if (matchCount > 0) {
        // Score based on percentage of query tokens matched
        const score = matchCount / queryTokens.length;
        results.push({ item, score });
      }
    });

    // Sort by score (descending) and then by name
    return results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.name.localeCompare(b.item.name);
    });
  }

  /**
   * Fuzzy search using Levenshtein distance
   */
  private fuzzySearch(query: string, candidateIndexes: Set<number>): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    candidateIndexes.forEach(idx => {
      const item = this.index!.content[idx];

      // Check multiple fields and use the best score
      const fieldsToSearch = [
        item.name,
        item.creator,
        item.category,
        item.collection,
        item.library,
        item.plugin
      ].filter(f => f); // Remove undefined/null fields

      let bestScore = 0;

      for (const field of fieldsToSearch) {
        if (!field) continue; // Extra safety check
        const fieldLower = field.toLowerCase();

        // Calculate Levenshtein distance
        const distance = this.levenshteinDistance(queryLower, fieldLower);

        // Normalize score (0-1, where 1 is exact match)
        const maxLen = Math.max(queryLower.length, fieldLower.length);
        const score = 1 - (distance / maxLen);

        if (score > bestScore) {
          bestScore = score;
        }
      }

      // Only include results with reasonable similarity (>0.3)
      if (bestScore > 0.3) {
        results.push({ item, score: bestScore });
      }
    });

    // Sort by score (descending)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Apply filters to get candidate item indexes
   */
  private applyFilters(filters?: SearchFilters): Set<number> {
    if (!this.index) return new Set();

    let candidateIndexes: Set<number> | null = null;

    // Apply content type filter
    if (filters?.contentType) {
      const typeMatches = this.typeIndex.get(filters.contentType) || [];
      candidateIndexes = new Set(typeMatches);
    }

    // Apply creator filter
    if (filters?.creator) {
      const creatorMatches = this.creatorIndex.get(filters.creator) || [];
      const creatorSet = new Set(creatorMatches);

      if (candidateIndexes) {
        // Intersection with existing candidates
        candidateIndexes = new Set([...candidateIndexes].filter(x => creatorSet.has(x)));
      } else {
        candidateIndexes = creatorSet;
      }
    }

    // Apply category filter
    if (filters?.category) {
      const categoryMatches = this.categoryIndex.get(filters.category) || [];
      const categorySet = new Set(categoryMatches);

      if (candidateIndexes) {
        candidateIndexes = new Set([...candidateIndexes].filter(x => categorySet.has(x)));
      } else {
        candidateIndexes = categorySet;
      }
    }

    // Apply genre filter with minimum score
    if (filters?.genre) {
      const minScore = filters.minGenreScore ?? 50;
      const genreMap = this.genreIndex.get(filters.genre);

      if (genreMap) {
        const genreMatches = new Set<number>();
        genreMap.forEach((score, idx) => {
          if (score >= minScore) {
            genreMatches.add(idx);
          }
        });

        if (candidateIndexes) {
          candidateIndexes = new Set([...candidateIndexes].filter(x => genreMatches.has(x)));
        } else {
          candidateIndexes = genreMatches;
        }
      } else {
        // No items match this genre
        candidateIndexes = new Set();
      }
    }

    // Apply vibe filter
    if (filters?.vibe) {
      const vibeMatches = this.vibeIndex.get(filters.vibe) || [];
      const vibeSet = new Set(vibeMatches);

      if (candidateIndexes) {
        candidateIndexes = new Set([...candidateIndexes].filter(x => vibeSet.has(x)));
      } else {
        candidateIndexes = vibeSet;
      }
    }

    // Apply playing mode filter
    if (filters?.playingMode) {
      const modeMatches = this.playingModeIndex.get(filters.playingMode) || [];
      const modeSet = new Set(modeMatches);

      if (candidateIndexes) {
        candidateIndexes = new Set([...candidateIndexes].filter(x => modeSet.has(x)));
      } else {
        candidateIndexes = modeSet;
      }
    }

    // Apply strum behavior filter
    if (filters?.hasStrumBehavior) {
      const strumSet = new Set(this.strumBehaviorIndex);

      if (candidateIndexes) {
        candidateIndexes = new Set([...candidateIndexes].filter(x => strumSet.has(x)));
      } else {
        candidateIndexes = strumSet;
      }
    }

    // If no filters applied, return all indexes
    if (!candidateIndexes) {
      candidateIndexes = new Set(this.index.content.map((_, idx) => idx));
    }

    return candidateIndexes;
  }

  /**
   * Get all content items with optional filters
   */
  list(filters?: SearchFilters, limit: number = 1000, offset: number = 0): ContentItem[] {
    if (!this.index) return [];

    const candidateIndexes = this.applyFilters(filters);
    const items: ContentItem[] = [];

    candidateIndexes.forEach(idx => {
      items.push(this.index!.content[idx]);
    });

    // Sort by name
    items.sort((a, b) => a.name.localeCompare(b.name));

    // Apply pagination
    return items.slice(offset, offset + limit);
  }

  /**
   * Get statistics
   */
  getStats(): any {
    if (!this.index) return null;

    return {
      totalContent: this.index.totals.total,
      scanDate: this.index.scanDate,
      scanDurationMs: this.index.scanDurationMs,
      contentTypes: this.index.contentTypes,
      totals: this.index.totals,
      stats: this.index.stats
    };
  }

  /**
   * Get all available content types
   */
  getContentTypes(): string[] {
    if (!this.index) return [];
    return this.index.contentTypes;
  }

  /**
   * Get all available creators
   */
  getCreators(): string[] {
    return Array.from(this.creatorIndex.keys()).sort();
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    return Array.from(this.categoryIndex.keys()).sort();
  }

  /**
   * Get all available genres
   */
  getGenres(): string[] {
    return Array.from(this.genreIndex.keys()).sort();
  }

  /**
   * Get all available vibes
   */
  getVibes(): string[] {
    return Array.from(this.vibeIndex.keys()).sort();
  }

  /**
   * Get all available playing modes
   */
  getPlayingModes(): string[] {
    return Array.from(this.playingModeIndex.keys()).sort();
  }

  /**
   * Search by genre, sorted by genre suitability score
   */
  searchByGenre(genre: string, query?: string, minScore: number = 50): SearchResult[] {
    if (!this.index) return [];

    const genreMap = this.genreIndex.get(genre);
    if (!genreMap) return [];

    // Get all items with this genre above minimum score
    const candidates: { idx: number; genreScore: number }[] = [];
    genreMap.forEach((score, idx) => {
      if (score >= minScore) {
        candidates.push({ idx, genreScore: score });
      }
    });

    // If query provided, filter by text search
    if (query) {
      const queryTokens = this.tokenize(query);
      const results: SearchResult[] = [];

      for (const { idx, genreScore } of candidates) {
        const item = this.index.content[idx];
        const allTokens = new Set([
          ...item.nameTokens,
          ...(item.creator ? this.tokenize(item.creator) : []),
          ...(item.category ? this.tokenize(item.category) : []),
          ...(item.collection ? this.tokenize(item.collection) : []),
          ...(item.library ? this.tokenize(item.library) : []),
          ...(item.plugin ? this.tokenize(item.plugin) : [])
        ]);

        const matchCount = queryTokens.filter(qt => allTokens.has(qt)).length;
        if (matchCount > 0) {
          // Combined score: text match + genre score bonus
          const textScore = matchCount / queryTokens.length;
          const combinedScore = textScore * 0.5 + (genreScore / 100) * 0.5;
          results.push({ item, score: combinedScore });
        }
      }

      return results.sort((a, b) => b.score - a.score);
    }

    // No query, just return sorted by genre score
    return candidates
      .sort((a, b) => b.genreScore - a.genreScore)
      .map(({ idx, genreScore }) => ({
        item: this.index!.content[idx],
        score: genreScore / 100
      }));
  }

  /**
   * Find instruments suitable for a specific use case
   * Returns items sorted by combined score of genre match and quality
   */
  findInstrumentsForGenre(
    genre: string,
    options: {
      minScore?: number;
      vibe?: string;
      playingMode?: string;
      limit?: number;
    } = {}
  ): SearchResult[] {
    const { minScore = 70, vibe, playingMode, limit = 20 } = options;

    const filters: SearchFilters = {
      genre,
      minGenreScore: minScore,
      vibe,
      playingMode
    };

    const candidateIndexes = this.applyFilters(filters);
    const genreMap = this.genreIndex.get(genre);

    if (!genreMap || !this.index) return [];

    const results: SearchResult[] = [];

    candidateIndexes.forEach(idx => {
      const item = this.index!.content[idx];
      const genreScore = genreMap.get(idx) || 0;

      // Calculate combined score
      let score = genreScore / 100;

      // Boost by quality if available
      if (item.quality) {
        const qualityAvg = (
          item.quality.trustworthiness +
          item.quality.professionalism +
          item.quality.generalAppeal
        ) / 300;
        score = score * 0.7 + qualityAvg * 0.3;
      }

      results.push({ item, score });
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Check if index is loaded
   */
  isLoaded(): boolean {
    return this.index !== null;
  }

  /**
   * Get index status
   */
  getStatus(): any {
    return {
      loaded: this.isLoaded(),
      contentCount: this.index?.content.length || 0,
      scanDate: this.index?.scanDate || null,
      version: this.index?.version || null,
      filePath: CONTENT_FILE
    };
  }

  /**
   * Tokenize string into searchable tokens
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s\-_()]+/)
      .filter(t => t.length > 0);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Reload index from disk (for rescans)
   */
  async reload(): Promise<boolean> {
    console.log('[ContentSearch] Reloading content index...');
    return this.loadFromFile();
  }
}
