import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FlaskConical, ClipboardList } from 'lucide-react';
import ContainerTable from '@/sections/ContainerTable';
import OperationLogTable from '@/sections/OperationLogTable';
import type { OperationLog } from '@/types';
import { deriveContainers } from '@/types';

function loadStorage<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
}
function saveStorage<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }

/**
 * Single-source-of-truth architecture:
 * - Only Operation Log is stored persistently.
 * - Container data is derived in real time from Operation Log.
 * - When you export/import, you only need the Operation Log CSV.
 *   Containers are auto-recreated on import based on add operations.
 */
export default function Home() {
  const [logs, setLogs] = useState<OperationLog[]>(() => loadStorage<OperationLog[]>('lab-operations', []));
  const [activeTab, setActiveTab] = useState('operations');

  // Containers are 100% derived from logs — never stored separately
  const containers = useMemo(() => deriveContainers(logs), [logs]);

  useEffect(() => saveStorage('lab-operations', logs), [logs]);

  // ---- Operation Log CRUD (the only table you edit) ----

  const addLog = useCallback((log: Omit<OperationLog, 'id'>) => {
    setLogs(prev => {
      const newId = prev.length > 0 ? Math.max(...prev.map(l => l.id)) + 1 : 1;
      return [...prev, { ...log, id: newId }];
    });
  }, []);

  const updateLog = useCallback((id: number, updates: Partial<OperationLog>) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } as OperationLog : l));
  }, []);

  const deleteLog = useCallback((id: number) => {
    setLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  const setAllLogs = useCallback((newLogs: OperationLog[]) => {
    setLogs(newLogs);
  }, []);

  // Delete a container = delete all linked operation logs
  const deleteContainer = useCallback((containerId: number) => {
    if (!confirm('Delete this container and all its linked operation logs?')) return;
    setLogs(prev => prev.filter(l => {
      if (l.type === 'add') return l.containerId !== containerId;
      if (l.type === 'extract') {
        const srcs = l.sources.split(',').map(p => p.trim()).filter(Boolean);
        return !srcs.some(s => s.startsWith(`${containerId} `));
      }
      return true;
    }));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Lab Reagent Tracker</h1>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />Operation Log
            </TabsTrigger>
            <TabsTrigger value="containers" className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />Containers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Operation Log</CardTitle>
                <CardDescription>
                  The only data table. Add operations auto-create containers.
                  Export this single table to transfer all data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OperationLogTable
                  logs={logs}
                  containers={containers}
                  onAdd={addLog}
                  onUpdate={updateLog}
                  onDelete={deleteLog}
                  onSetAll={setAllLogs}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="containers" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Containers</CardTitle>
                <CardDescription>
                  Real-time derived view. No add button — containers are
                  auto-created when you log add operations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContainerTable
                  containers={containers}
                  logs={logs}
                  onDelete={deleteContainer}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
