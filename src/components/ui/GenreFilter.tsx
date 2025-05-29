'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface GenreFilterProps {
  genres: string[];
  selectedGenres: string[];
  onGenreChange: (genre: string) => void;
}

const GenreFilter = ({
  genres,
  selectedGenres,
  onGenreChange,
}: GenreFilterProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayCount = 8; // Number of genres to display before "Show More"

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-gray-900 font-medium mb-3">Genres</h3>
      
      <div className="space-y-2">
        {genres.slice(0, isExpanded ? genres.length : displayCount).map((genre) => (
          <div key={genre} className="flex items-center">
            <button
              onClick={() => onGenreChange(genre)}
              className="group flex items-center w-full text-left"
            >
              <div 
                className={`w-4 h-4 mr-2 rounded flex items-center justify-center border ${
                  selectedGenres.includes(genre)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {selectedGenres.includes(genre) && (
                  <svg 
                    width="10" 
                    height="10" 
                    viewBox="0 0 10 10" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      d="M8.33334 2.5L3.75001 7.08333L1.66667 5" 
                      stroke="white" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span className={`text-sm ${
                selectedGenres.includes(genre)
                  ? 'text-indigo-600 font-medium'
                  : 'text-gray-700 group-hover:text-gray-900'
              }`}>
                {genre}
              </span>
            </button>
          </div>
        ))}
      </div>
      
      {genres.length > displayCount && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 text-indigo-600 text-sm font-medium hover:text-indigo-700 transition-colors focus:outline-none"
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </button>
      )}
    </div>
  );
};

export default GenreFilter; 