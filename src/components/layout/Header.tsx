'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiMenu, FiX, FiBook, FiSearch, FiArrowRight, FiHome, FiGrid, FiInfo, FiUsers, FiLayers, FiDatabase } from 'react-icons/fi';
import MotionIcon from '../ui/MotionIcon';
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
      className={`sticky top-0 z-50 w-full transition-all duration-300 text-base-content ${
        isScrolled 
          ? 'bg-base-100/95 backdrop-blur-lg shadow-md border-b border-base-200 py-2' 
          : 'bg-base-100/80 backdrop-blur-md border-b border-base-200 py-3'
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
                className="text-primary bg-primary/10 p-2 rounded-xl"
              >
                <FiBook size={24} />
              </motion.div>
              <span className="font-bold text-2xl text-base-content ml-2">বই</span>
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
              className="absolute -bottom-2 h-1 bg-primary rounded-full opacity-0 transition-all duration-300"
            />
            
            <Link 
              href="/" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/' ? 'text-primary' : 'text-base-content/80 hover:text-primary'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <MotionIcon animation="bounce">
                  <FiHome size={16} className={activeLink === '/' ? 'text-primary' : 'text-base-content/60 group-hover:text-primary'} />
                </MotionIcon>
                <span>Home</span>
              </div>
            </Link>
            
            <Link 
              href="/books" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/books' ? 'text-primary' : 'text-base-content/80 hover:text-primary'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <MotionIcon animation="float">
                  <FiBook size={16} className={activeLink === '/books' ? 'text-primary' : 'text-base-content/60 group-hover:text-primary'} />
                </MotionIcon>
                <span>Books</span>
              </div>
            </Link>
            
            <Link 
              href="/genres" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/genres' ? 'text-primary' : 'text-base-content/80 hover:text-primary'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <MotionIcon animation="wiggle">
                  <FiGrid size={16} className={activeLink === '/genres' ? 'text-primary' : 'text-base-content/60 group-hover:text-primary'} />
                </MotionIcon>
                <span>Genres</span>
              </div>
            </Link>
            
            <Link 
              href="/authors" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/authors' ? 'text-primary' : 'text-base-content/80 hover:text-primary'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <MotionIcon animation="pulse">
                  <FiUsers size={16} className={activeLink === '/authors' ? 'text-primary' : 'text-base-content/60 group-hover:text-primary'} />
                </MotionIcon>
                <span>Authors</span>
              </div>
            </Link>
            
            <Link 
              href="/series" 
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/series' ? 'text-primary' : 'text-base-content/80 hover:text-primary'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <MotionIcon animation="bounce">
                  <FiLayers size={16} className={activeLink === '/series' ? 'text-primary' : 'text-base-content/60 group-hover:text-primary'} />
                </MotionIcon>
                <span>Series</span>
              </div>
            </Link>

            <Link
              href="/dataset"
              className={`px-4 py-2 mx-1 rounded-lg font-medium transition-all duration-300 relative group ${
                activeLink === '/dataset' ? 'text-primary' : 'text-base-content/80 hover:text-primary'
              }`}
              onMouseEnter={animateIndicator}
              onMouseLeave={hideIndicator}
            >
              <div className="flex items-center gap-1.5">
                <MotionIcon animation="pulse">
                  <FiDatabase size={16} className={activeLink === '/dataset' ? 'text-primary' : 'text-base-content/60 group-hover:text-primary'} />
                </MotionIcon>
                <span>Dataset</span>
              </div>
            </Link>
          </div>

          {/* Search, Login & Mobile Menu Button */}
          <div ref={actionsRef} className="flex items-center space-x-2">
            <motion.button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`btn btn-ghost btn-circle btn-sm transition-all duration-300 ${
                isSearchOpen 
                  ? 'btn-active text-primary' 
                  : 'text-base-content/70 hover:text-primary'
              }`}
              aria-label="Search"
            >
              <MotionIcon animation="spin">
                <FiSearch size={18} />
              </MotionIcon>
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
              className="md:hidden btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-primary"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <MotionIcon animation="wiggle">
                {isMenuOpen ? <FiX size={18} /> : <FiMenu size={18} />}
              </MotionIcon>
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
                className="input input-bordered w-full pr-12 bg-base-100 text-base-content"
                autoFocus
              />
              <button className="btn btn-primary btn-sm absolute right-2 top-1/2 -translate-y-1/2">
                <MotionIcon animation="spin">
                  <FiSearch size={16} />
                </MotionIcon>
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
            <div className="bg-base-200/95 backdrop-blur-md rounded-box shadow-xl border border-base-300 p-4">
              <div className="flex flex-col space-y-1">
                <Link 
                  href="/" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-base-300 text-base-content transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <MotionIcon animation="bounce">
                    <FiHome size={18} className="text-base-content/60" />
                  </MotionIcon>
                  <span className="font-medium">Home</span>
                </Link>
                <Link 
                  href="/books" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-base-300 text-base-content transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <MotionIcon animation="float">
                    <FiBook size={18} className="text-base-content/60" />
                  </MotionIcon>
                  <span className="font-medium">Books</span>
                </Link>
                <Link 
                  href="/genres" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-base-300 text-base-content transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <MotionIcon animation="wiggle">
                    <FiGrid size={18} className="text-base-content/60" />
                  </MotionIcon>
                  <span className="font-medium">Genres</span>
                </Link>
                <Link 
                  href="/authors" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-base-300 text-base-content transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <MotionIcon animation="pulse">
                    <FiUsers size={18} className="text-base-content/60" />
                  </MotionIcon>
                  <span className="font-medium">Authors</span>
                </Link>
                <Link 
                  href="/series" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-base-300 text-base-content transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <MotionIcon animation="bounce">
                    <FiLayers size={18} className="text-base-content/60" />
                  </MotionIcon>
                  <span className="font-medium">Series</span>
                </Link>
                <Link
                  href="/dataset"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-base-300 text-base-content transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <MotionIcon animation="pulse">
                    <FiDatabase size={18} className="text-base-content/60" />
                  </MotionIcon>
                  <span className="font-medium">Dataset</span>
                </Link>
                
                {/* Mobile Theme Toggle */}
                <div className="sm:hidden border-t border-base-300 mt-2 pt-3 flex justify-center">
                  <ThemeToggle />
                </div>
                
                {/* Mobile Sign In Button */}
                <div className="sm:hidden border-t border-base-300 mt-2 pt-3">
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
