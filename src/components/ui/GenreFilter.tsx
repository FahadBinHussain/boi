'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiFilter } from 'react-icons/fi';
import MotionIcon from './MotionIcon';

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
        <h2 className="text-lg font-bold text-base-content">Filter by Genre</h2>
        <div className="flex items-center gap-2">
          {selectedGenres.length > 0 && (
            <button
              onClick={onClearFilters}
              className="btn btn-ghost btn-xs rounded-full gap-1 border border-base-300 text-base-content"
            >
              <MotionIcon animation="spin" trigger="hover">
                <FiX size={14} />
              </MotionIcon>
              Clear filters
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="md:hidden btn btn-ghost btn-xs gap-1 text-base-content"
          >
            <MotionIcon animation="wiggle" trigger="hover">
              <FiFilter size={16} />
            </MotionIcon>
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
      className={`btn btn-sm rounded-full transition-all ${
        isSelected
          ? 'btn-primary shadow-sm'
          : 'btn-ghost border border-base-300 bg-base-200/50 hover:bg-base-200 text-base-content'
      }`}
    >
      {genre}
    </motion.button>
  );
};

export default GenreFilter; 