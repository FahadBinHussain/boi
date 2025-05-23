'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface CategoryFilterProps {
  categories: string[];
  selectedCategories: string[];
  onCategoryChange: (category: string) => void;
}

const CategoryFilter = ({
  categories,
  selectedCategories,
  onCategoryChange,
}: CategoryFilterProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayCount = 8; // Number of categories to display before "Show More"

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-gray-900 font-medium mb-3">Categories</h3>
      
      <div className="space-y-2">
        {categories.slice(0, isExpanded ? categories.length : displayCount).map((category) => (
          <div key={category} className="flex items-center">
            <button
              onClick={() => onCategoryChange(category)}
              className="group flex items-center w-full text-left"
            >
              <div 
                className={`w-4 h-4 mr-2 rounded flex items-center justify-center border ${
                  selectedCategories.includes(category)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {selectedCategories.includes(category) && (
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
                selectedCategories.includes(category)
                  ? 'text-indigo-600 font-medium'
                  : 'text-gray-700 group-hover:text-gray-900'
              }`}>
                {category}
              </span>
            </button>
          </div>
        ))}
      </div>
      
      {categories.length > displayCount && (
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

export default CategoryFilter; 