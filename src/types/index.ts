export type ContainerBaseType = 'MRS' | 'MRS T' | 'YPD' | 'YPD T';
export type OperationType = 'add' | 'extract';

/** Extract source: "containerId volume" pair */
export interface ExtractSource {
  containerId: number;
  volume: number;
}

/**
 * Container — fully real-time derived from Operation Log.
 * NOT stored separately; computed on the fly from logs.
 */
export interface Container {
  id: number;
  baseType: ContainerBaseType;
  capacity: number; // current actual amount = sum(add) - sum(extract from this container)
  used: number;     // cumulative extracted = sum(extract from this container)
}

/**
 * Operation Log — the ONLY persistent table.
 *
 * Table headers:
 *   ID           : auto-increment
 *   Date         : operation date
 *   Type         : add / extract
 *   ContainerID  : target container for add; empty for extract
 *   Components   : component list for add; purpose for extract
 *   Sources      : extract sources like "1 10, 2 10"; empty for add
 *   Volume       : total volume in L
 *   Category     : MRS / MRS T / YPD / YPD T (container type for add)
 */
export interface OperationLog {
  id: number;
  date: string;
  type: OperationType;
  containerId: number | null;
  components: string;
  sources: string;       // "1 10, 2 10" format, empty for add
  volume: number;
  category: ContainerBaseType | '';
}

// ============================================
// Component Parsing (for add operations)
// ============================================

export function parseComponents(input: string): { category: string; items: number[] }[] {
  const result: { category: string; items: number[] }[] = [];
  const segments = input.split(';').map(s => s.trim()).filter(Boolean);
  for (const segment of segments) {
    const match = segment.match(/^([A-Z]+(?:\s+T)?)\s+(.+)$/i);
    if (!match) continue;
    let category = match[1].toUpperCase().replace(/\s+/g, ' ');
    const rest = match[2];
    if (category === 'G') category = 'MRS';
    const items: number[] = [];
    const parts = rest.split(',').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end))
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) items.push(i);
      } else {
        const num = Number(part);
        if (!isNaN(num)) items.push(num);
      }
    }
    if (items.length > 0) result.push({ category, items: [...new Set(items)].sort((a, b) => a - b) });
  }
  return result;
}

export function inferLiquidType(components: string): string {
  const parsed = parseComponents(components);
  if (parsed.length === 0) return 'Unknown';
  return parsed.map(p => p.category).filter((v, i, a) => a.indexOf(v) === i).join(' + ');
}

// ============================================
// Compatibility Check
// ============================================

export function checkCompatibility(baseType: ContainerBaseType, components: string): { valid: boolean; reason?: string } {
  const parsed = parseComponents(components);
  if (parsed.length === 0) return { valid: false, reason: 'No valid components' };
  const cats = parsed.map(p => p.category);
  switch (baseType) {
    case 'MRS': for (const c of cats) if (c !== 'MRS') return { valid: false, reason: `MRS only, found "${c}"` }; break;
    case 'MRS T': for (const c of cats) if (c !== 'MRS T') return { valid: false, reason: `MRS T only, found "${c}"` }; break;
    case 'YPD': for (const c of cats) if (c !== 'YPD') return { valid: false, reason: `YPD only, found "${c}"` }; break;
    case 'YPD T': for (const c of cats) if (c !== 'YPD T') return { valid: false, reason: `YPD T only, found "${c}"` }; break;
  }
  return { valid: true };
}

// ============================================
// Sources string parsing/formatting
//   Format: "1 10, 2 10" → [{containerId:1,volume:10}, {containerId:2,volume:10}]
// ============================================

export function parseSources(sourcesStr: string): ExtractSource[] {
  if (!sourcesStr.trim()) return [];
  const result: ExtractSource[] = [];
  const parts = sourcesStr.split(',').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(\d+)\s+(\d+(?:\.\d+)?)$/);
    if (m) result.push({ containerId: Number(m[1]), volume: Number(m[2]) });
  }
  return result;
}

export function formatSources(sources: ExtractSource[]): string {
  return sources.map(s => `${s.containerId} ${s.volume}`).join(', ');
}

// ============================================
// Derive containers from operation logs in real time
// ============================================

export function deriveContainers(logs: OperationLog[]): Container[] {
  // Collect all container IDs and their base types from add operations
  const containerInfo = new Map<number, ContainerBaseType>();
  for (const log of logs) {
    if (log.type === 'add' && log.containerId != null && log.category) {
      if (!containerInfo.has(log.containerId)) {
        containerInfo.set(log.containerId, log.category as ContainerBaseType);
      }
    }
  }

  // Calculate capacity and used for each container
  const stats = new Map<number, { cap: number; used: number }>();

  for (const log of logs) {
    if (log.type === 'add' && log.containerId != null) {
      if (!stats.has(log.containerId)) stats.set(log.containerId, { cap: 0, used: 0 });
      stats.get(log.containerId)!.cap += log.volume;
    }
    if (log.type === 'extract') {
      const srcs = parseSources(log.sources);
      for (const src of srcs) {
        if (!stats.has(src.containerId)) stats.set(src.containerId, { cap: 0, used: 0 });
        const s = stats.get(src.containerId)!;
        s.cap -= src.volume;
        s.used += src.volume;
      }
    }
  }

  // Build container list
  const containers: Container[] = [];
  for (const [id, baseType] of containerInfo) {
    const s = stats.get(id) ?? { cap: 0, used: 0 };
    containers.push({
      id,
      baseType,
      capacity: Math.max(0, Math.round(s.cap * 1000) / 1000),
      used: Math.round(s.used * 1000) / 1000,
    });
  }
  return containers.sort((a, b) => a.id - b.id);
}
