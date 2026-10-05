'use client';

import React, { useState, useMemo } from 'react';
import type { Category, Subcategory } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SlidersHorizontal, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExcludeCategoryPopoverProps {
  categories: Category[];
  excludedCategoryIds: string[];
  excludedSubcategoryKeys: string[];
  onToggleCategory: (category: Category) => void;
  onToggleSubcategory: (category: Category, subcategory: Subcategory) => void;
  onClearAll: () => void;
  isCategoryExcluded: (category: Category) => boolean;
  isSubcategoryExcluded: (category: Category, subcategory: Subcategory) => boolean;
}

export function ExcludeCategoryPopover({
  categories,
  excludedCategoryIds,
  excludedSubcategoryKeys,
  onToggleCategory,
  onToggleSubcategory,
  onClearAll,
  isCategoryExcluded,
  isSubcategoryExcluded,
}: ExcludeCategoryPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());

  const totalExcludedCount = excludedCategoryIds.length + excludedSubcategoryKeys.length;

  const toggleExpand = (categoryId: string) => {
    setExpandedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;

    const term = searchTerm.toLowerCase().trim();
    return categories.filter(cat => {
      const catMatches = cat.name.toLowerCase().includes(term);
      const subMatches = (cat.subcategories || []).some(sub =>
        sub.name.toLowerCase().includes(term)
      );
      return catMatches || subMatches;
    });
  }, [categories, searchTerm]);

  const renderCategoryIcon = (category: Category) => {
    if (category && category.icon) {
      const Icon = typeof category.icon === 'string' ? () => null : category.icon;
      return <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />;
    }
    return null;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 text-xs gap-1.5 transition-colors',
            totalExcludedCount > 0 && 'border-primary/50 bg-primary/5 text-primary'
          )}
          title="Exclude categories and subcategories from the daily chart"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Exclude</span>
          {totalExcludedCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 px-1.5 py-0 h-4 min-w-4 text-[10px] leading-none font-semibold bg-primary/10 text-primary border-primary/20"
            >
              {totalExcludedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-3 shadow-lg" align="end">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <h4 className="text-sm font-semibold leading-none">Exclude from Chart</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Hide selected categories or subcategories from daily overview.
            </p>
          </div>
          {totalExcludedCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative my-2.5">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search category or subcategory..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Categories List */}
        <ScrollArea className="h-64 pr-2">
          <div className="space-y-1">
            {filteredCategories.map(cat => {
              const isCatExcluded = isCategoryExcluded(cat);
              const subcats = cat.subcategories || [];
              const hasSubcats = subcats.length > 0;
              const isSearching = searchTerm.trim().length > 0;
              const isExpanded = isSearching || expandedCategoryIds.has(cat.id);
              const excludedSubcatsCount = subcats.filter(sub => isSubcategoryExcluded(cat, sub)).length;

              const visibleSubcats = isSearching
                ? subcats.filter(sub =>
                    sub.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
                    cat.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
                  )
                : subcats;

              return (
                <div
                  key={cat.id}
                  className={cn(
                    'rounded-md border border-transparent transition-colors',
                    isCatExcluded && 'bg-destructive/5 border-destructive/20'
                  )}
                >
                  {/* Category Header Row */}
                  <div className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <Checkbox
                        id={`cat-chk-${cat.id}`}
                        checked={isCatExcluded}
                        onCheckedChange={() => onToggleCategory(cat)}
                      />
                      <label
                        htmlFor={`cat-chk-${cat.id}`}
                        className="flex items-center space-x-1.5 text-xs font-medium cursor-pointer select-none truncate flex-1"
                      >
                        {renderCategoryIcon(cat)}
                        <span className={cn('truncate', isCatExcluded && 'line-through text-muted-foreground')}>
                          {cat.name}
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      {!isCatExcluded && excludedSubcatsCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 text-amber-600 border-amber-300 dark:border-amber-700"
                        >
                          {excludedSubcatsCount} sub excluded
                        </Badge>
                      )}
                      {hasSubcats && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(cat.id)}
                          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                          title={isExpanded ? 'Collapse subcategories' : 'Expand subcategories'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subcategories (if expanded) */}
                  {hasSubcats && isExpanded && (
                    <div className="pl-6 pr-1 py-1 space-y-1 bg-muted/20 rounded-b-md border-l-2 border-primary/20 ml-3">
                      {visibleSubcats.map(sub => {
                        const isSubExcluded = isSubcategoryExcluded(cat, sub);
                        const isChecked = isCatExcluded || isSubExcluded;

                        return (
                          <div
                            key={sub.id || sub.name}
                            className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/60 text-xs"
                          >
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <Checkbox
                                id={`sub-chk-${cat.id}-${sub.id || sub.name}`}
                                checked={isChecked}
                                disabled={isCatExcluded}
                                onCheckedChange={() => onToggleSubcategory(cat, sub)}
                              />
                              <label
                                htmlFor={`sub-chk-${cat.id}-${sub.id || sub.name}`}
                                className={cn(
                                  'text-xs cursor-pointer select-none truncate flex-1',
                                  isCatExcluded
                                    ? 'text-muted-foreground line-through opacity-70'
                                    : isSubExcluded
                                    ? 'text-destructive font-medium line-through'
                                    : 'text-foreground font-normal'
                                )}
                              >
                                {sub.name}
                              </label>
                            </div>
                            {isCatExcluded ? (
                              <span className="text-[10px] text-muted-foreground italic">
                                Entire category
                              </span>
                            ) : isSubExcluded ? (
                              <Badge
                                variant="destructive"
                                className="text-[9px] px-1 py-0 h-3.5 leading-none"
                              >
                                Excluded
                              </Badge>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCategories.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">
                No categories match &quot;{searchTerm}&quot;
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="pt-2.5 border-t mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {totalExcludedCount > 0 ? (
              <span className="font-medium text-foreground">
                {totalExcludedCount} item{totalExcludedCount > 1 ? 's' : ''} excluded
              </span>
            ) : (
              'All categories included'
            )}
          </span>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-7 text-xs px-3"
            onClick={() => setIsOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
