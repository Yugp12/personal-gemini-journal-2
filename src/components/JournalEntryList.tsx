import React, { useState, useMemo } from 'react';
import type { JournalEntry } from '../types';
import { JournalEntryCard } from './JournalEntryCard';
import { Search, ArrowUpDown, Smile, Tag, BookOpen } from 'lucide-react';

interface JournalEntryListProps {
  entries: JournalEntry[];
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => Promise<void>;
  userId: string;
}

export function JournalEntryList({
  entries,
  onEdit,
  onDelete,
  userId
}: JournalEntryListProps) {
  const [search, setSearch] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const moods = useMemo(() => {
    return Array.from(new Set(entries.map((e) => e.mood).filter(Boolean)));
  }, [entries]);

  const tags = useMemo(() => {
    return Array.from(new Set(entries.flatMap((e) => e.tags || [])));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => {
        const query = search.toLowerCase();
        const matchesQuery =
          !search.trim() ||
          e.title.toLowerCase().includes(query) ||
          e.content.toLowerCase().includes(query) ||
          (e.tags && e.tags.some((t) => t.toLowerCase().includes(query)));

        const matchesMood = selectedMood === 'all' || e.mood === selectedMood;
        const matchesTag = selectedTag === 'all' || (e.tags && e.tags.includes(selectedTag));

        return matchesQuery && matchesMood && matchesTag;
      })
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [entries, search, selectedMood, selectedTag, sortOrder]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      {entries.length > 0 && (
        <div className="p-4 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              id="filter-search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your journal by title, keyword, or tag..."
              className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:outline-hidden focus:border-neutral-900 text-neutral-900 placeholder:text-neutral-400"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Mood filter */}
              <select
                id="filter-mood-select"
                value={selectedMood}
                onChange={(e) => setSelectedMood(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 font-medium text-xs focus:border-neutral-900 cursor-pointer"
              >
                <option value="all">All Moods ({entries.length})</option>
                {moods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Tag filter */}
              {tags.length > 0 && (
                <select
                  id="filter-tag-select"
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 font-medium text-xs focus:border-neutral-900 cursor-pointer"
                >
                  <option value="all">All Tags ({tags.length})</option>
                  {tags.map((t) => (
                    <option key={t} value={t}>
                      #{t}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600 font-medium cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
        </div>
      )}

      {/* List of Entries or Empty State */}
      {entries.length === 0 ? (
        <div 
          id="journal-empty-state" 
          className="p-12 md:p-16 text-center bg-white rounded-3xl border border-neutral-200/90 shadow-xs space-y-3"
        >
          <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-600">
            <BookOpen className="w-6 h-6 text-neutral-500" />
          </div>
          <h4 className="text-base font-bold text-neutral-900">No journal entries yet.</h4>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Write your first entry above. Each reflection is stored privately in your Google UID namespace.
          </p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-neutral-200 text-xs text-neutral-500">
          No reflections match your active search or filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onEdit={onEdit}
              onDelete={onDelete}
              userId={userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
