'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiMenu, FiX, FiBook, FiSearch, FiHome, FiGrid, FiUsers, FiLayers, FiDatabase } from 'react-icons/fi';
import MotionIcon from '../ui/MotionIcon';
import LoginButton from '../auth/LoginButton';
import ThemeToggle from '../theme/ThemeToggle';
import { useDismissable } from '@/hooks/useDismissable';
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Escape closes the mobile navigation and returns focus to the button that
  // opened it. Without that a keyboard user is stuck inside the panel.
  useDismissable(isMenuOpen, () => setIsMenuOpen(false), menuButtonRef, mobileMenuRef);
  
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
    const logo = logoRef.current;
    const nav = navItemsRef.current;
    const actions = actionsRef.current;
    if (!logo || !nav || !actions) return;

    // Flatten the live HTMLCollections into plain arrays once.
    // The desktop nav is display:none below the md breakpoint; targeting it as
    // a live collection made the old tween chain stall there, which left the
    // search and menu buttons stuck at opacity 0 and pushed off-screen.
    const targets = [logo, ...Array.from(nav.children), ...Array.from(actions.children)].filter(Boolean);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // One tween over every target, so nothing can be left behind at opacity 0.
    // clearProps hands the elements back to their natural CSS state.
    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power2.out', clearProps: 'opacity,transform' }
    );

    // GSAP advances on requestAnimationFrame, which a browser throttles to
    // nothing in a background tab. Without this the search and menu buttons
    // would sit at opacity 0 until the tab is focused. setTimeout still fires
    // when hidden, so drop the entrance state outright if the tween never ran.
    const safety = window.setTimeout(() => {
      if (tween.progress() < 1) {
        tween.kill();
        gsap.set(targets, { clearProps: 'opacity,transform' });
      }
    }, 1500);

    return () => window.clearTimeout(safety);
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
      className={`sticky top-0 z-50 w-full transition-[background-color,border-color,box-shadow,backdrop-filter,padding] duration-300 text-base-content ${
        isScrolled 
          ? 'bg-base-100/95 backdrop-blur-lg shadow-md border-b border-base-200 py-2' 
          : 'bg-base-100/80 backdrop-blur-md border-b border-base-200 py-3'
      }`}
    >
      <div className="shell">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 z-10">
            <div ref={logoRef} className="flex items-center">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 10 }}
                transition={{ type: "spring", stiffness: 400 }}
                className="text-primary bg-primary/10 p-2 rounded-xl"
              >
                <FiBook size={24} />
              </motion.div>
              <span lang="bn" className="font-bold text-2xl text-base-content ms-2">বই</span>
            </div>
          </Link>

          {/* Desktop Navigation
              The rail only appears from `lg`. Between `md` and `lg` the six
              links plus the wordmark and the action row do not fit the shell,
              and the header used to push the whole page sideways at 768px. */}
          <div 
            ref={navItemsRef}
            className="hidden lg:flex items-center relative py-1"
          >
            {navItems.map((item) => {
              const isActive = isLinkActive(item.href);
              const Icon = item.icon;

              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`px-3 mx-0.5 xl:px-4 xl:mx-1 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 relative group flex items-center gap-1.5 ${
                    isActive 
                      ? 'text-primary' 
                      : 'text-base-content/75 hover:text-base-content hover:bg-base-200/60'
                  }`}
                >
                  <MotionIcon animation={item.animation} trigger={isActive ? 'always' : 'hover'}>
                    <Icon 
                      size={16} 
                      className={isActive ? 'text-primary' : 'text-base-content/75 group-hover:text-primary transition-colors'} 
                    />
                  </MotionIcon>
                  <span>{item.label}</span>

                  {/* Active navigation marker with smooth layoutId animation */}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active-marker"
                      className="absolute -bottom-1.5 inset-inline-2 h-1 bg-primary rounded-full shadow-[0_2px_8px_rgba(var(--p),0.4)]"
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
          <div ref={actionsRef} className="flex items-center gap-3">
            <motion.button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className={`btn btn-ghost btn-circle btn-sm transition-colors duration-300 ${
                isSearchOpen 
                  ? 'btn-active text-primary' 
                  : 'text-base-content/75 hover:text-primary'
              }`}
              aria-label="Search books"
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
              ref={menuButtonRef}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className="lg:hidden btn btn-ghost btn-circle btn-sm text-base-content/75 hover:text-primary"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
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
            className="py-4"
          >
            <div className="relative">
              <input
                type="text"
                placeholder="Search for books…"
                aria-label="Search books"
                className="input input-bordered w-full pe-12 bg-base-100 text-base-content"
                autoFocus
              />
              <button
                type="button"
                aria-label="Search"
                className="btn btn-primary btn-sm absolute end-2 top-1/2 -translate-y-1/2"
              >
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
            id="mobile-menu"
            ref={mobileMenuRef}
            className="lg:hidden py-4 overflow-hidden"
          >
            <div className="bg-base-200/95 backdrop-blur-md rounded-box shadow-xl border border-base-300 p-4">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const isActive = isLinkActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link 
                      key={item.href}
                      href={item.href} 
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary font-bold border-s-4 border-primary'
                          : 'text-base-content/75 hover:bg-base-300 hover:text-base-content'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <MotionIcon animation={item.animation} trigger={isActive ? 'always' : 'hover'}>
                        <Icon size={18} className={isActive ? 'text-primary' : 'text-base-content/75'} />
                      </MotionIcon>
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="badge badge-primary badge-xs ms-auto">Active</span>
                      )}
                    </Link>
                  );
                })}
                
                {/* Mobile Theme Toggle */}
                <div className="lg:hidden border-t border-base-300 mt-2 pt-3 flex justify-center">
                  <ThemeToggle />
                </div>
                
                {/* Mobile Sign In Button */}
                <div className="lg:hidden border-t border-base-300 mt-2 pt-3">
                  <div>
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
