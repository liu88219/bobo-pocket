import React, { createContext, useContext, useMemo } from 'react';
import { CategoryDef } from '../types/pocket';
import { DEFAULT_CATEGORIES, categoryMeta } from '../data/categories';

interface CategoryContextValue {
  list: CategoryDef[];
  meta: (id: string) => CategoryDef;
}

const CategoryContext = createContext<CategoryContextValue>({
  list: DEFAULT_CATEGORIES,
  meta: (id) => categoryMeta(DEFAULT_CATEGORIES, id),
});

export const CategoryProvider: React.FC<{ categories: CategoryDef[]; children: React.ReactNode }> = ({ categories, children }) => {
  const value = useMemo<CategoryContextValue>(
    () => ({ list: categories, meta: (id: string) => categoryMeta(categories, id) }),
    [categories]
  );
  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
};

export function useCategories(): CategoryContextValue {
  return useContext(CategoryContext);
}
