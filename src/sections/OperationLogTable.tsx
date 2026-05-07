import { useState, useMemo } from 'react';
import type { OperationLog, Container, ContainerBaseType } from '@/types';
import { checkCompatibility, formatSources } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Pencil, Trash2, Download, Upload, AlertCircle, Droplets, Filter, RotateCcw } from 'lucide-react';

interface Props {
  logs: OperationLog[];
  containers: Container[];
  onAdd: (log: Omit<OperationLog, 'id'>) => void;
  onUpdate: (id: number, updates: Partial<OperationLog>) => void;
  onDelete: (id: number) => void;
  onSetAll: (logs: OperationLog[]) => void;
}

const CATEGORIES: ContainerBaseType[] = ['MRS', 'MRS T', 'YPD', 'YPD T'];

export default function OperationLogTable({ logs, containers, onAdd, onUpdate, onDelete, onSetAll }: Props) {
  // ---- Filters ----
  const [textSearch, setTextSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'add' | 'extract'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | ContainerBaseType>('all');
  const [filterContainerId, setFilterContainerId] = useState('');

  // ---- Dialogs ----
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // ---- Add form ----
  const [form, setForm] = useState({ date: '', containerId: '', components: '', volume: '', category: 'MRS' as ContainerBaseType });
  const [error, setError] = useState('');

  // ---- Extract form ----
  const [extractSelections, setExtractSelections] = useState<Map<number, string>>(new Map());
  const [extractPurpose, setExtractPurpose] = useState('');

  const containerMap = useMemo(() => {
    const map = new Map<number, Container>();
    for (const c of containers) map.set(c.id, c);
    return map;
  }, [containers]);

  // ---- Filter logic (AND) ----
  const filtered = useMemo(() => {
    return [...logs]
      .sort((a, b) => b.id - a.id)
      .filter(l => {
        // 1. Text search (any field)
        if (textSearch.trim()) {
          const q = textSearch.toLowerCase();
          const hay = [
            String(l.id), l.date, l.type, String(l.containerId ?? ''),
            l.components, l.sources, String(l.volume), l.category,
          ].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        // 2. Date range
        if (dateFrom && l.date < dateFrom) return false;
        if (dateTo && l.date > dateTo) return false;
        // 3. Type
        if (filterType !== 'all' && l.type !== filterType) return false;
        // 4. Category
        if (filterCategory !== 'all' && l.category !== filterCategory) return false;
        // 5. Container ID
        if (filterContainerId && String(l.containerId) !== filterContainerId) return false;
        return true;
      });
  }, [logs, textSearch, dateFrom, dateTo, filterType, filterCategory, filterContainerId]);

  const hasFilters = textSearch || dateFrom || dateTo || filterType !== 'all' || filterCategory !== 'all' || filterContainerId;

  const resetFilters = () => {
    setTextSearch('');
    setDateFrom('');
    setDateTo('');
    setFilterType('all');
    setFilterCategory('all');
    setFilterContainerId('');
  };

  // ---- Dialog handlers ----
  const openAdd = () => {
    setEditingId(null);
    setForm({ date: new Date().toISOString().split('T')[0], containerId: '', components: '', volume: '', category: 'MRS' });
    setError('');
    setAddDialogOpen(true);
  };

  const openEdit = (l: OperationLog) => {
    setEditingId(l.id);
    setForm({
      date: l.date,
      containerId: l.containerId ? String(l.containerId) : '',
      components: l.components,
      volume: String(l.volume),
      category: (l.category as ContainerBaseType) || 'MRS',
    });
    setError('');
    setAddDialogOpen(true);
  };

  const openExtract = () => {
    setExtractSelections(new Map());
    setExtractPurpose('');
    setExtractDialogOpen(true);
  };

  const validateAdd = (): boolean => {
    if (!form.date) { setError('Date is required'); return false; }
    if (!form.containerId) { setError('Container ID is required'); return false; }
    if (!form.components.trim()) { setError('Components are required'); return false; }
    if (!form.volume || Number(form.volume) <= 0) { setError('Volume must be > 0'); return false; }
    const compat = checkCompatibility(form.category, form.components);
    if (!compat.valid) { setError(compat.reason!); return false; }
    setError('');
    return true;
  };

  const saveAdd = () => {
    if (!validateAdd()) return;
    const data = {
      date: form.date,
      type: 'add' as const,
      containerId: Number(form.containerId),
      components: form.components,
      sources: '',
      volume: Number(form.volume),
      category: form.category,
    };
    if (editingId !== null) onUpdate(editingId, data);
    else onAdd(data);
    setAddDialogOpen(false);
  };

  const saveExtract = () => {
    if (!extractPurpose.trim()) { setError('Purpose is required'); return; }
    const sourcesArr: { containerId: number; volume: number }[] = [];
    let total = 0;
    extractSelections.forEach((volStr, cid) => {
      const vol = Number(volStr);
      if (vol > 0) { sourcesArr.push({ containerId: cid, volume: vol }); total += vol; }
    });
    if (sourcesArr.length === 0) { setError('Select at least one container'); return; }
    onAdd({
      date: new Date().toISOString().split('T')[0],
      type: 'extract',
      containerId: null,
      components: extractPurpose,
      sources: formatSources(sourcesArr),
      volume: Math.round(total * 1000) / 1000,
      category: '',
    });
    setExtractDialogOpen(false);
    setError('');
  };

  const toggleExtractSelection = (cid: number) => {
    setExtractSelections(prev => {
      const next = new Map(prev);
      if (next.has(cid)) next.delete(cid);
      else next.set(cid, '');
      return next;
    });
  };

  // ---- Export / Import ----
  const exportCSV = () => {
    const headers = ['ID', 'Date', 'Type', 'ContainerID', 'Components', 'Sources', 'Volume_L', 'Category'];
    const rows = logs.map(l => [
      l.id, l.date, l.type,
      l.containerId ?? '',
      `"${l.components}"`,
      l.sources ? `"${l.sources}"` : '',
      l.volume,
      l.category,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = () => {
    const input = document.getElementById('operation-import') as HTMLInputElement;
    input?.click();
  };

  // ---- Active filter pills ----
  const filterPills = [];
  if (dateFrom) filterPills.push(`From: ${dateFrom}`);
  if (dateTo) filterPills.push(`To: ${dateTo}`);
  if (filterType !== 'all') filterPills.push(`Type: ${filterType}`);
  if (filterCategory !== 'all') filterPills.push(`Category: ${filterCategory}`);
  if (filterContainerId) filterPills.push(`Container: #${filterContainerId}`);

  return (
    <div className="space-y-4">
      {/* Toolbar row 1: text search + action buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search any field..."
            value={textSearch}
            onChange={e => setTextSearch(e.target.value)}
            className="max-w-sm"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="w-3 h-3 mr-1" />Clear
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" />Export</Button>
          <Button variant="outline" size="sm" onClick={importCSV}><Upload className="w-4 h-4 mr-1" />Import</Button>
          <input id="operation-import" type="file" accept=".csv" className="hidden" onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const text = reader.result as string;
              const lines = text.split(/\r?\n/).filter(Boolean);
              const newLogs: OperationLog[] = [];
              for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                if (cols.length >= 8) {
                  newLogs.push({
                    id: Number(cols[0]),
                    date: cols[1],
                    type: (cols[2] as 'add' | 'extract') || 'add',
                    containerId: cols[3] ? Number(cols[3]) : null,
                    components: cols[4].replace(/^"|"$/g, ''),
                    sources: cols[5].replace(/^"|"$/g, ''),
                    volume: Number(cols[6]),
                    category: cols[7] as ContainerBaseType || '',
                  });
                }
              }
              onSetAll(newLogs);
            };
            reader.readAsText(file);
            (e.target as HTMLInputElement).value = '';
          }} />
          <Button variant="outline" size="sm" onClick={openExtract}><Droplets className="w-4 h-4 mr-1" />Extract</Button>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </div>
      </div>

      {/* Filter row: date range, type, category, container id */}
      <div className="flex items-center gap-3 flex-wrap bg-muted/50 p-3 rounded-lg">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="grid gap-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase">From</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div className="grid gap-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase">To</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div className="grid gap-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase">Type</label>
          <div className="flex gap-1">
            {(['all', 'add', 'extract'] as const).map(t => (
              <Button key={t} variant={filterType === t ? 'default' : 'outline'} size="sm" className="h-8 text-xs capitalize px-3" onClick={() => setFilterType(t)}>
                {t}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase">Category</label>
          <div className="flex gap-1">
            {(['all', ...CATEGORIES] as const).map(c => (
              <Button key={c} variant={filterCategory === c ? 'default' : 'outline'} size="sm" className="h-8 text-xs px-2" onClick={() => setFilterCategory(c)}>
                {c}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase">Container</label>
          <Input
            type="number"
            placeholder="#ID"
            value={filterContainerId}
            onChange={e => setFilterContainerId(e.target.value)}
            className="h-8 text-sm w-20"
          />
        </div>
      </div>

      {/* Active filter pills */}
      {filterPills.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {filterPills.map((pill, i) => (
            <Badge key={i} variant="secondary" className="text-xs font-normal">{pill}</Badge>
          ))}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={resetFilters}>
            <RotateCcw className="w-3 h-3 mr-1" />Reset all
          </Button>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {logs.length} records
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>ContainerID</TableHead>
              <TableHead>Components</TableHead>
              <TableHead>Sources</TableHead>
              <TableHead className="text-right">Volume (L)</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-[80px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {logs.length === 0 ? 'No records.' : 'No records match the filters.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.id}</TableCell>
                  <TableCell>{l.date}</TableCell>
                  <TableCell>
                    <Badge variant={l.type === 'extract' ? 'destructive' : 'default'} className="text-xs capitalize">{l.type}</Badge>
                  </TableCell>
                  <TableCell>{l.containerId ?? '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={l.components}>{l.components || '—'}</TableCell>
                  <TableCell className="max-w-[160px] truncate" title={l.sources}>{l.sources || '—'}</TableCell>
                  <TableCell className="text-right">
                    <span className={l.type === 'extract' ? 'text-destructive font-medium' : ''}>
                      {l.type === 'extract' ? '-' : '+'}{l.volume}
                    </span>
                  </TableCell>
                  <TableCell>
                    {l.category ? <Badge variant="secondary" className="text-xs">{l.category}</Badge> : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm('Delete?')) onDelete(l.id); }}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId !== null ? 'Edit' : 'Add'} Operation</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2"><label className="text-sm font-medium">Date</label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
              <div className="grid gap-2"><label className="text-sm font-medium">Container ID</label><Input type="number" value={form.containerId} onChange={e => setForm({...form, containerId: e.target.value})} placeholder="e.g. 101" /></div>
              <div className="grid gap-2"><label className="text-sm font-medium">Volume (L)</label><Input type="number" step="0.01" min="0" value={form.volume} onChange={e => setForm({...form, volume: e.target.value})} /></div>
            </div>
            {form.containerId && Number(form.containerId) > 0 && (
              <p className="text-xs text-muted-foreground">
                {containerMap.get(Number(form.containerId))
                  ? `Existing #${form.containerId} (${containerMap.get(Number(form.containerId))!.baseType}) — capacity: ${containerMap.get(Number(form.containerId))!.capacity}L`
                  : `New container #${form.containerId} will be auto-created`
                }
              </p>
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Category</label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map(c => (
                  <Button key={c} type="button" variant={form.category === c ? 'default' : 'outline'} size="sm" onClick={() => setForm({...form, category: c})}>{c}</Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Components</label>
              <Input value={form.components} onChange={e => setForm({...form, components: e.target.value})} placeholder="MRS 1-6,G1; YPD T 1,3" />
              <p className="text-xs text-muted-foreground">MRS 1-6,G1; YPD T 1,3; YPD 1-8; G1-3</p>
            </div>
            {form.components && (() => {
              const r = checkCompatibility(form.category, form.components);
              return <div className={`text-xs px-2 py-1 rounded ${r.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{r.valid ? '\u2713 Compatible' : '\u2717 ' + r.reason}</div>;
            })()}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button><Button onClick={saveAdd}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract Dialog */}
      <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>Extract Liquid</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="grid gap-2"><label className="text-sm font-medium">Purpose</label><Input value={extractPurpose} onChange={e => setExtractPurpose(e.target.value)} placeholder="e.g. Deliver to PCR lab" /></div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Containers</label>
              {containers.length === 0 ? <p className="text-center text-muted-foreground py-4">No containers.</p> : containers.map(c => {
                const isSel = extractSelections.has(c.id);
                return (
                  <div key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isSel ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <Checkbox checked={isSel} onCheckedChange={() => toggleExtractSelection(c.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="font-medium text-sm">#{c.id}</span><Badge variant="secondary" className="text-[10px]">{c.baseType}</Badge></div>
                      <div className="text-xs text-muted-foreground">Capacity: {c.capacity}L | Used: {c.used}L</div>
                    </div>
                    {isSel && <Input type="number" step="0.01" min="0" max={c.capacity} placeholder="L" className="w-24" value={extractSelections.get(c.id) || ''} onChange={e => { setExtractSelections(prev => { const next = new Map(prev); next.set(c.id, e.target.value); return next; }); }} />}
                  </div>
                );
              })}
            </div>
            <div className="text-sm text-muted-foreground border-t pt-2">Total: <span className="font-semibold text-foreground">{Math.round(Array.from(extractSelections.entries()).reduce((s, [, v]) => s + (Number(v) || 0), 0) * 1000) / 1000} L</span></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setExtractDialogOpen(false); setError(''); }}>Cancel</Button><Button variant="destructive" onClick={saveExtract} disabled={extractSelections.size === 0}>Extract</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let col = '', inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') {
      if (inQuotes && line[j + 1] === '"') { col += '"'; j++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { cols.push(col); col = ''; }
    else col += ch;
  }
  cols.push(col);
  return cols;
}
