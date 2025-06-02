'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiFilter } from 'react-icons/fi';

interface GenreFilterProps {
  genres: string[];
  selectedGenres: string[];
  onGenreToggle: (genre: string) => void;
  onClearFilters: () => void;
}

const GenreFilter = ({ genres, selectedGenres, onGenreToggle, onClearFilters }: GenreFilterProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Filter by Genre</h2>
        <div className="flex items-center gap-2">
          {selectedGenres.length > 0 && (
            <button
              onClick={onClearFilters}
              className="text-xs flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <FiX size={14} />
              Clear filters
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="md:hidden flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300"
          >
            <FiFilter size={16} />
            {isExpanded ? 'Hide' : 'Show'} filters
          </button>
        </div>
      </div>

      <div className={`md:block ${isExpanded ? 'block' : 'hidden'}`}>
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <GenreButton
              key={genre}
              genre={genre}
              isSelected={selectedGenres.includes(genre)}
              onToggle={() => onGenreToggle(genre)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface GenreButtonProps {
  genre: string;
  isSelected: boolean;
  onToggle: () => void;
}

const GenreButton = ({ genre, isSelected, onToggle }: GenreButtonProps) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
        isSelected
          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {genre}
    </motion.button>
  );
};

export default GenreFilter; 