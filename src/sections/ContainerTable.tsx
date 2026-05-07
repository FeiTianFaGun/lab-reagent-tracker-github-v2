import { useState, useMemo } from 'react';
import type { Container, OperationLog } from '@/types';
import { parseSources } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Trash2, History, AlertTriangle } from 'lucide-react';

interface Props {
  containers: Container[];
  logs: OperationLog[];
  onDelete: (containerId: number) => void;
}

const TYPE_COLORS: Record<string, string> = {
  'MRS': 'bg-blue-100 text-blue-800',
  'MRS T': 'bg-indigo-100 text-indigo-800',
  'YPD': 'bg-amber-100 text-amber-800',
  'YPD T': 'bg-orange-100 text-orange-800',
};

/**
 * ContainerTable — pure derived view.
 * No add button. Containers are auto-created by add operations in Operation Log.
 */
export default function ContainerTable({ containers, logs, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return containers;
    return containers.filter(c =>
      String(c.id).includes(q) ||
      String(c.capacity).includes(q) ||
      String(c.used).includes(q) ||
      c.baseType.toLowerCase().includes(q)
    );
  }, [containers, search]);

  // Aggregate totals by baseType
  const typeTotals = useMemo(() => {
    const map = new Map<string, { count: number; capacity: number; used: number }>();
    for (const c of containers) {
      const cur = map.get(c.baseType) ?? { count: 0, capacity: 0, used: 0 };
      cur.count++;
      cur.capacity += c.capacity;
      cur.used += c.used;
      map.set(c.baseType, cur);
    }
    return map;
  }, [containers]);

  // Find all logs that affect this container
  const containerLogs = useMemo(() => {
    if (!historyId) return [];
    return logs.filter(l => {
      if (l.type === 'add') return l.containerId === historyId;
      if (l.type === 'extract') {
        const srcs = parseSources(l.sources);
        return srcs.some(s => s.containerId === historyId);
      }
      return false;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, historyId]);

  const historyContainer = containers.find(c => c.id === historyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search containers..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        </div>
        <p className="text-xs text-muted-foreground">
          Containers are auto-created from Operation Log
        </p>
      </div>

      {/* Type totals summary */}
      {containers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['MRS', 'MRS T', 'YPD', 'YPD T'] as const).map(t => {
            const stat = typeTotals.get(t);
            return (
              <div key={t} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${TYPE_COLORS[t]} border-0 text-xs`}>{t}</Badge>
                  <span className="text-xs text-muted-foreground">{stat ? stat.count : 0} containers</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">{stat ? Math.round(stat.capacity * 1000) / 1000 : 0}</span>
                  <span className="text-muted-foreground text-xs ml-1">L</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Used: {stat ? Math.round(stat.used * 1000) / 1000 : 0} L
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Base Type</TableHead>
              <TableHead className="text-right">Capacity (L)</TableHead>
              <TableHead className="text-right">Used (L)</TableHead>
              <TableHead className="w-[80px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No containers. Log an add operation to create one.
                </TableCell>
              </TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>
                  <Badge className={`${TYPE_COLORS[c.baseType]} border-0 font-medium`}>
                    {c.baseType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {c.capacity}
                  {c.capacity < 0 && <AlertTriangle className="w-3 h-3 inline ml-1 text-destructive" />}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{c.used}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title="History" onClick={() => { setHistoryId(c.id); setHistoryOpen(true); }}>
                    <History className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(c.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Container #{historyId}
              {historyContainer && (
                <Badge className={`ml-2 ${TYPE_COLORS[historyContainer.baseType]} border-0`}>
                  {historyContainer.baseType}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {historyContainer && (
              <div className="grid grid-cols-3 gap-3 text-sm bg-muted p-3 rounded-md">
                <div><strong>Capacity:</strong> {historyContainer.capacity} L</div>
                <div><strong>Used:</strong> {historyContainer.used} L</div>
                <div><strong>Type:</strong> {historyContainer.baseType}</div>
              </div>
            )}
            {containerLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No linked operations.</p>
            ) : (
              <div className="rounded-md border max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {containerLogs.map(l => {
                      const isExtract = l.type === 'extract';
                      const vol = isExtract
                        ? (parseSources(l.sources).find(s => s.containerId === historyId)?.volume ?? 0)
                        : l.volume;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.id}</TableCell>
                          <TableCell>{l.date}</TableCell>
                          <TableCell>
                            <Badge variant={isExtract ? 'destructive' : 'default'} className="text-xs capitalize">{l.type}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate" title={l.components}>
                            {isExtract ? <span className="italic text-muted-foreground">{l.components}</span> : l.components}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={isExtract ? 'text-destructive' : ''}>{isExtract ? '-' : '+'}{vol}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
