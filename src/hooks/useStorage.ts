import { useState, useEffect, useCallback } from 'react';

export function useStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

export function useStorageWithActions<T extends { id: number }>(key: string, initialValue: T[]) {
  const [items, setItems] = useStorage<T[]>(key, initialValue);

  const add = useCallback((item: Omit<T, 'id'>) => {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    const newItem = { ...item, id: newId } as T;
    setItems(prev => [...prev, newItem]);
    return newItem;
  }, [items, setItems]);

  const update = useCallback((id: number, updates: Partial<T>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } as T : item));
  }, [setItems]);

  const remove = useCallback((id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, [setItems]);

  const getById = useCallback((id: number) => {
    return items.find(item => item.id === id);
  }, [items]);

  const importAll = useCallback((data: T[]) => {
    setItems(data);
  }, [setItems]);

  return { items, setItems, add, update, remove, getById, importAll };
}
