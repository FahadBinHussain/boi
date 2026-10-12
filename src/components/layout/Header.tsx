'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiMenu, FiX, FiBook, FiSearch, FiHome, FiGrid, FiUsers, FiLayers, FiDatabase } from 'react-icons/fi';
import MotionIcon from '../ui/MotionIcon';
import LoginButton from '../auth/LoginButton';
import ThemeToggle from '../theme/ThemeToggle';
import gsap from 'gsap';

const navItems = [
  { href: '/', label: 'Home', icon: FiHome, animation: 'bounce' as const },
  { href: '/books', label: 'Books', icon: FiBook, animation: 'float' as const },
  { href: '/genres', label: 'Genres', icon: FiGrid, animation: 'wiggle' as const },
  { href: '/authors', label: 'Authors', icon: FiUsers, animation: 'pulse' as const },
  { href: '/series', label: 'Series', icon: FiLayers, animation: 'bounce' as const },
  { href: '/dataset', label: 'Dataset', icon: FiDatabase, animation: 'pulse' as const },
];

const Header = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const headerRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const navItemsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  
  const isLinkActive = (href: string) => {
    if (!pathname) return href === '/';
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  
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
            className="hidden md:flex items-center relative py-1"
          >
            {navItems.map((item) => {
              const isActive = isLinkActive(item.href);
              const Icon = item.icon;

              return (
                <Link 
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 mx-1 rounded-xl text-sm font-semibold transition-colors duration-200 relative group flex items-center gap-1.5 ${
                    isActive 
                      ? 'text-primary' 
                      : 'text-base-content/75 hover:text-base-content hover:bg-base-200/60'
                  }`}
                >
                  <MotionIcon animation={item.animation} trigger={isActive ? 'always' : 'hover'}>
                    <Icon 
                      size={16} 
                      className={isActive ? 'text-primary' : 'text-base-content/60 group-hover:text-primary transition-colors'} 
                    />
                  </MotionIcon>
                  <span>{item.label}</span>

                  {/* Active navigation marker with smooth layoutId animation */}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active-marker"
                      className="absolute -bottom-1.5 left-2 right-2 h-1 bg-primary rounded-full shadow-[0_2px_8px_rgba(var(--p),0.4)]"
                      transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 32
                      }}
                    />
                  )}
                </Link>
              );
            })}
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
                {navItems.map((item) => {
                  const isActive = isLinkActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link 
                      key={item.href}
                      href={item.href} 
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary font-bold border-l-4 border-primary'
                          : 'text-base-content/70 hover:bg-base-300 hover:text-base-content'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <MotionIcon animation={item.animation} trigger={isActive ? 'always' : 'hover'}>
                        <Icon size={18} className={isActive ? 'text-primary' : 'text-base-content/60'} />
                      </MotionIcon>
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="badge badge-primary badge-xs ml-auto">Active</span>
                      )}
                    </Link>
                  );
                })}
                
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
