'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiMenu, FiX, FiBook, FiSearch } from 'react-icons/fi';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <motion.div
              whileHover={{ rotate: 10 }}
              className="text-indigo-600"
            >
              <FiBook size={24} />
            </motion.div>
            <span className="font-bold text-xl text-gray-900">BookVault</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-700 hover:text-indigo-600 transition-colors">
              Home
            </Link>
            <Link href="/books" className="text-gray-700 hover:text-indigo-600 transition-colors">
              Books
            </Link>
            <Link href="/categories" className="text-gray-700 hover:text-indigo-600 transition-colors">
              Categories
            </Link>
            <Link href="/about" className="text-gray-700 hover:text-indigo-600 transition-colors">
              About
            </Link>
          </nav>

          {/* Search & Mobile Menu Button */}
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Search"
            >
              <FiSearch size={20} />
            </button>
            
            <button
              className="md:hidden p-2 rounded-full hover:bg-gray-100 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
          </div>
        </div>

        {/* Search Bar - Conditional Rendering */}
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-3"
          >
            <div className="relative">
              <input
                type="text"
                placeholder="Search for books..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
              <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                <FiSearch size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Mobile Navigation - Conditional Rendering */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="md:hidden py-3"
          >
            <div className="flex flex-col space-y-3">
              <Link 
                href="/" 
                className="px-4 py-2 rounded-md hover:bg-gray-100 text-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                href="/books" 
                className="px-4 py-2 rounded-md hover:bg-gray-100 text-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Books
              </Link>
              <Link 
                href="/categories" 
                className="px-4 py-2 rounded-md hover:bg-gray-100 text-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Categories
              </Link>
              <Link 
                href="/about" 
                className="px-4 py-2 rounded-md hover:bg-gray-100 text-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </header>
  );
};

export default Header; 