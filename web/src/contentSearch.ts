/**
 * Jeannie - Content Search Index
 * Version: 0.7.0
 *
 * Provides fast searchable access to all Bitwig content (devices, presets, samples)
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
  nameTokens: string[];
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
    });

    console.log(`[ContentSearch] Built indexes: ${this.tokenIndex.size} tokens, ${this.typeIndex.size} types, ${this.creatorIndex.size} creators`);
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
      const itemTokens = new Set(item.nameTokens);

      // Check if all query tokens are present
      const matchCount = queryTokens.filter(qt => itemTokens.has(qt)).length;

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
      const nameLower = item.name.toLowerCase();

      // Calculate Levenshtein distance
      const distance = this.levenshteinDistance(queryLower, nameLower);

      // Normalize score (0-1, where 1 is exact match)
      const maxLen = Math.max(queryLower.length, nameLower.length);
      const score = 1 - (distance / maxLen);

      // Only include results with reasonable similarity (>0.3)
      if (score > 0.3) {
        results.push({ item, score });
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
