'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiMenu, FiX, FiBook, FiSearch, FiArrowRight, FiHome, FiGrid, FiInfo, FiUsers, FiLayers } from 'react-icons/fi';
import LoginButton from '../auth/LoginButton';
import ThemeToggle from '../theme/ThemeToggle';
import gsap from 'gsap';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState('/');
  
  const headerRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const navItemsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  
  // Handle scroll event to change navbar appearance
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    
    // Set active link based on current path
    if (typeof window !== 'undefined') {
      setActiveLink(window.location.pathname);
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Initial animations with GSAP
  useEffect(() => {
    if (headerRef.current && logoRef.current && navItemsRef.current && actionsRef.current) {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      
      // Initial state
      gsap.set([logoRef.current, navItemsRef.current.children, actionsRef.current.children], { 
        opacity: 0, 
        y: -20 
      });
      
      // Animate navbar elements
      tl.to(logoRef.current, { 
        opacity: 1, 
        y: 0, 
        duration: 0.6 
      })
      .to(navItemsRef.current.children, { 
        opacity: 1, 
        y: 0, 
        stagger: 0.1, 
        duration: 0.4 
      }, "-=0.3")
      .to(actionsRef.current.children, { 
        opacity: 1, 
        y: 0, 
        stagger: 0.1, 
        duration: 0.4 
      }, "-=0.2");
    }
  }, []);
  
  // Handle search animation
  useEffect(() => {
    if (searchRef.current) {
      if (isSearchOpen) {
        gsap.fromTo(searchRef.current, 
          { opacity: 0, y: -10 }, 
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
        );
      }
    }
  }, [isSearchOpen]);
  
  // Handle mobile menu animation
  useEffect(() => {
    if (mobileMenuRef.current) {
      if (isMenuOpen) {
        gsap.fromTo(mobileMenuRef.current, 
          { opacity: 0, height: 0 }, 
          { opacity: 1, height: 'auto', duration: 0.4, ease: "power2.out" }
        );
        
        gsap.fromTo(mobileMenuRef.current.children, 
          { opacity: 0, y: 20 }, 
          { opacity: 1, y: 0, stagger: 0.05, duration: 0.3, delay: 0.1 }
        );
      }
    }
  }, [isMenuOpen]);
  
  // Animation for indicator
  const animateIndicator = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (indicatorRef.current && e.currentTarget) {
      const target = e.currentTarget;
      const targetRect = target.getBoundingClientRect();
      const navRect = navItemsRef.current?.getBoundingClientRect();
      
      if (navRect) {
        gsap.to(indicatorRef.current, {
          width: targetRect.width,
          left: targetRect.left - navRect.left,
          opacity: 1,
          duration: 0.3,
          ease: "power2.out"
        });
      }
    }
  };
  
  const hideIndicator = () => {
    if (indicatorRef.current) {
      gsap.to(indicatorRef.current, {
        opacity: 0,
        duration: 0.3
      });
    }
  };
  
  return (
    <header 
      ref={headerRef}
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg shadow-md dark:shadow-gray-900/30 py-2' 
          : 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 py-3'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 z-10">
            <div ref={logoRef} className="flex items-center">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 10 }}
                transition={{ type: "spring", stiffness: 400 }}
                className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-xl"
              >
                <FiBook size={24} />
              </motion.div>
              <span className="font-bold text-2xl text-gray-900 dark:text-white ml-2">বই</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div 
            ref={navItemsRef}
            className="hidden md:flex items-center relative"
          >
            {/* Indicator Line */}
            <div 
              ref={indicatorRef}
              className="absolute -bottom-2 h-1 bg-indigo-500 dark:bg-indigo-400 rounded-full opacity-0 transition-all duration-300"
            />
            
            <Link 
              href="/" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <FiHome size={16} className={activeLink === '/' ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'} />
                <span>Home</span>
              </div>
            </Link>
            
            <Link 
              href="/books" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/books' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <FiBook size={16} className={activeLink === '/books' ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'} />
                <span>Books</span>
              </div>
            </Link>
            
            <Link 
              href="/genres" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/genres' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <FiGrid size={16} className={activeLink === '/genres' ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'} />
                <span>Genres</span>
              </div>
            </Link>
            
            <Link 
              href="/authors" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/authors' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <FiUsers size={16} className={activeLink === '/authors' ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'} />
                <span>Authors</span>
              </div>
            </Link>
            
            <Link 
              href="/series" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/series' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <FiLayers size={16} className={activeLink === '/series' ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'} />
                <span>Series</span>
              </div>
            </Link>
          </div>

          {/* Search, Login & Mobile Menu Button */}
          <div ref={actionsRef} className="flex items-center space-x-3">
            <motion.button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`p-2 rounded-full transition-all duration-300 ${
                isSearchOpen 
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              aria-label="Search"
            >
              <FiSearch size={20} />
            </motion.button>
            
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            
            <div className="hidden sm:block">
              <LoginButton />
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </motion.button>
          </div>
        </div>

        {/* Search Bar - Conditional Rendering */}
        {isSearchOpen && (
          <div 
            ref={searchRef}
            className="py-4 px-2"
          >
            <div className="relative">
              <input
                type="text"
                placeholder="Search for books..."
                className="w-full px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all duration-300"
                autoFocus
              />
              <button className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-indigo-500 dark:bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors">
                <FiSearch size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Mobile Navigation - Conditional Rendering */}
        {isMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="md:hidden py-4 overflow-hidden"
          >
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-4">
              <div className="flex flex-col space-y-2">
                <Link 
                  href="/" 
                  className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FiHome size={18} className="text-gray-400 dark:text-gray-500" />
                  <span className="font-medium">Home</span>
                </Link>
                <Link 
                  href="/books" 
                  className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FiBook size={18} className="text-gray-400 dark:text-gray-500" />
                  <span className="font-medium">Books</span>
                </Link>
                <Link 
                  href="/genres" 
                  className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FiGrid size={18} className="text-gray-400 dark:text-gray-500" />
                  <span className="font-medium">Genres</span>
                </Link>
                <Link 
                  href="/authors" 
                  className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FiUsers size={18} className="text-gray-400 dark:text-gray-500" />
                  <span className="font-medium">Authors</span>
                </Link>
                <Link 
                  href="/series" 
                  className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FiLayers size={18} className="text-gray-400 dark:text-gray-500" />
                  <span className="font-medium">Series</span>
                </Link>
                
                {/* Mobile Theme Toggle */}
                <div className="sm:hidden border-t border-gray-100 dark:border-gray-800 mt-2 pt-3 flex justify-center">
                  <ThemeToggle />
                </div>
                
                {/* Mobile Sign In Button */}
                <div className="sm:hidden border-t border-gray-100 dark:border-gray-800 mt-2 pt-3">
                  <div onClick={() => setIsMenuOpen(false)}>
                    <LoginButton />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 