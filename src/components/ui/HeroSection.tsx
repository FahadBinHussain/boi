'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiSearch, FiBook, FiLogIn, FiArrowRight } from 'react-icons/fi';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const HeroSection = () => {
  const { data: session } = useSession();
  const heroRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subheadingRef = useRef<HTMLDivElement>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const bookCardsRef = useRef<HTMLDivElement>(null);
  const decorativeShapeRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create a master timeline for better sequence control
    const masterTl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => console.log("All hero animations complete")
    });
    
    // Create decorative elements and animations
    if (heroRef.current && glowRef.current && decorativeShapeRef.current) {
      // Set initial states
      gsap.set(glowRef.current, { 
        opacity: 0,
        scale: 0.8
      });
      
      gsap.set(decorativeShapeRef.current, {
        opacity: 0,
        scale: 0.9,
        rotation: -5
      });
      
      // Add background glow and decorative shape animations
      masterTl
        .to(glowRef.current, {
          opacity: 0.8,
          scale: 1,
          duration: 1.5,
          ease: "power2.out"
        }, 0)
        .to(decorativeShapeRef.current, {
          opacity: 0.7,
          scale: 1,
          rotation: 0,
          duration: 1.2,
          ease: "power1.out"
        }, 0.3);
    }
    
    // Main heading animation
    const heading = headingRef.current;
    const subheading = subheadingRef.current;
    const paragraph = paragraphRef.current;
    const buttons = buttonsRef.current;
    const bookCards = bookCardsRef.current;
    
    if (heading && subheading && paragraph && buttons && typeof window !== 'undefined') {
      // Set up main heading animation
      const mainHeadingText = "Discover";
      const subHeadingText = "and Download";
      const highlightedText = "Free Books";
      
      // Set up the HTML structure properly
      heading.innerHTML = ''; // Clear the heading
      heading.style.opacity = '1';
      
      // Create container for the main text part
      const mainHeadingContainer = document.createElement('div');
      mainHeadingContainer.className = 'flex flex-col sm:flex-row items-baseline gap-2 sm:gap-3';
      
      // Create spans for each character in the main heading
      const mainHeadingSpan = document.createElement('span');
      mainHeadingSpan.className = 'inline-block';
      
      mainHeadingText.split('').forEach(char => {
        const charSpan = document.createElement('span');
        charSpan.innerText = char === ' ' ? '\u00A0' : char;
        charSpan.style.display = 'inline-block';
        charSpan.style.opacity = '0';
        mainHeadingSpan.appendChild(charSpan);
      });
      
      // Create the subheading part
      const subHeadingDiv = document.createElement('div');
      subHeadingDiv.className = 'inline-block text-4xl sm:text-5xl font-normal text-gray-700';
      
      subHeadingText.split('').forEach(char => {
        const charSpan = document.createElement('span');
        charSpan.innerText = char === ' ' ? '\u00A0' : char;
        charSpan.style.display = 'inline-block';
        charSpan.style.opacity = '0';
        subHeadingDiv.appendChild(charSpan);
      });
      
      // Add main heading and subheading to container
      mainHeadingContainer.appendChild(mainHeadingSpan);
      mainHeadingContainer.appendChild(subHeadingDiv);
      
      // Add the heading container
      heading.appendChild(mainHeadingContainer);
      
      // Create the highlighted text part
      const highlightedDiv = document.createElement('div');
      highlightedDiv.className = 'mt-2 relative inline-block';
      
      const highlightedSpan = document.createElement('span');
      highlightedSpan.className = 'text-indigo-600 relative z-10';
      
      // Create spans for each character in the highlighted text
      highlightedText.split('').forEach(char => {
        const charSpan = document.createElement('span');
        charSpan.innerText = char === ' ' ? '\u00A0' : char;
        charSpan.style.display = 'inline-block';
        charSpan.style.opacity = '0';
        highlightedSpan.appendChild(charSpan);
      });
      
      // Add a decorative underline element
      const underlineElement = document.createElement('span');
      underlineElement.className = 'absolute -bottom-1 left-0 h-3 bg-indigo-200 w-0 z-0 rounded-full';
      
      // Add the highlighted elements to the div
      highlightedDiv.appendChild(highlightedSpan);
      highlightedDiv.appendChild(underlineElement);
      
      // Add the highlighted div to the heading
      heading.appendChild(highlightedDiv);
      
      // Get all character spans for animation
      const mainHeadingChars = mainHeadingSpan.querySelectorAll('span');
      const subHeadingChars = subHeadingDiv.querySelectorAll('span');
      const highlightedChars = highlightedSpan.querySelectorAll('span');
      
      // Add heading animations to timeline
      masterTl
        // Main heading animation
        .to(mainHeadingChars, {
          opacity: 1,
          y: 0, 
          stagger: 0.02,
          duration: 0.4,
          ease: "power2.out",
        }, 0.3)
        // Subheading animation
        .to(subHeadingChars, {
          opacity: 1,
          y: 0,
          stagger: 0.02,
          duration: 0.4,
          ease: "power2.out",
        }, 0.6)
        // Highlighted text animation
        .to(highlightedChars, {
          opacity: 1,
          y: 0,
          stagger: 0.03,
          duration: 0.5,
          ease: "back.out(1.2)",
        }, 0.9)
        // Animate the decorative underline
        .to(underlineElement, {
          width: '100%',
          duration: 0.8,
          ease: "power3.inOut"
        }, 1.2);
      
      // Add paragraph animation
      masterTl.fromTo(paragraph, 
        { opacity: 0, y: 20 }, 
        { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 
        1.0
      );
      
      // Add buttons animation with bounce effect
      masterTl.fromTo(buttons.querySelectorAll('a'), 
        { opacity: 0, y: 20, scale: 0.95 }, 
        { 
          opacity: 1, 
          y: 0, 
          scale: 1,
          stagger: 0.15, 
          duration: 0.7,
          ease: "back.out(1.7)" 
        }, 
        1.2
      );
      
      // Book cards animation with 3D effect
      if (bookCards && window.innerWidth >= 768) {
        const cards = bookCards.querySelectorAll('div[class*="absolute"]');
        
        // Add cards animation to the master timeline
        masterTl.fromTo(cards, 
          { 
            opacity: 0, 
            scale: 0.8,
            rotationY: 25,
            z: -100,
            transformPerspective: 600,
            transformOrigin: "center center",
            rotation: (i) => [-10, 5, 12][i] 
          }, 
          { 
            opacity: 1, 
            scale: 1,
            rotationY: 0,
            z: 0,
            rotation: (i) => [-8, 5, 12][i],
            stagger: 0.2,
            duration: 1,
            ease: "elastic.out(1, 0.5)" 
          }, 
          0.9
        );
        
        // Add hover effect for book cards with 3D perspective
        cards.forEach((card, index) => {
          card.addEventListener('mouseenter', () => {
            gsap.to(card, { 
              y: -15, 
              scale: 1.05, 
              rotationY: 5,
              rotation: ([-6, 7, 10])[index],
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)',
              duration: 0.3, 
              ease: 'power2.out', 
              zIndex: 10 
            });
          });
          
          card.addEventListener('mouseleave', () => {
            gsap.to(card, { 
              y: 0, 
              scale: 1, 
              rotationY: 0,
              rotation: ([-8, 5, 12])[index],
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
              duration: 0.5, 
              ease: 'power2.out',
              zIndex: 1 
            });
          });
        });
      }
    }
    
    // Create a background animation with gradient movement
    gsap.to('.hero-gradient', {
      backgroundPosition: '100% 50%',
      duration: 15,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
    
    // Create a floating animation for the decorative elements
    if (decorativeShapeRef.current) {
      gsap.to(decorativeShapeRef.current, {
        y: '-15px',
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    }
    
    // Clean up function
    return () => {
      masterTl.kill();
      gsap.killTweensOf('.hero-gradient');
      if (decorativeShapeRef.current) {
        gsap.killTweensOf(decorativeShapeRef.current);
      }
    };
  }, []);

  return (
    <div ref={heroRef} className="relative overflow-hidden">
      {/* Background elements */}
      <div className="hero-gradient bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-20 sm:py-28 bg-[length:200%_100%]">
        {/* Decorative background glow */}
        <div 
          ref={glowRef}
          className="absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-indigo-300/20 to-purple-400/20 blur-3xl -translate-y-1/2"
        ></div>
        
        {/* Decorative geometric shape */}
        <div 
          ref={decorativeShapeRef}
          className="absolute top-1/4 right-1/3 w-[300px] h-[300px] rounded-3xl border border-indigo-200 rotate-12 backdrop-blur-md bg-white/10"
        ></div>
        
        {/* Main content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-7">
              <h1 
                ref={headingRef}
                className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight"
              >
                Discover and Download 
                <span className="text-indigo-600"> Free Books</span>
              </h1>
              
              <div ref={subheadingRef} className="mb-3 text-xl text-indigo-600 font-medium">
                Your gateway to knowledge and imagination
              </div>
              
              <p 
                ref={paragraphRef}
                className="text-lg text-gray-600 mb-8 max-w-lg leading-relaxed"
              >
                Access thousands of free books from various genres. Expand your knowledge and dive into new adventures without any cost.
              </p>

              <div 
                ref={buttonsRef} 
                className="flex flex-col sm:flex-row gap-4"
              >
                <Link href="/books" className="inline-block">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all duration-300 w-full sm:w-auto"
                  >
                    <FiBook size={18} />
                    Browse Library
                    <FiArrowRight className="ml-1" size={16} />
                  </motion.button>
                </Link>
                
                <Link href="/categories" className="inline-block">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-900 font-medium py-3 px-6 rounded-xl border border-gray-200 shadow-md shadow-gray-200/30 backdrop-blur-sm transition-all duration-300 w-full sm:w-auto"
                  >
                    <FiSearch size={18} />
                    Explore Categories
                  </motion.button>
                </Link>
              </div>
              
              {/* Sign In Call to Action - Only shown when user is not logged in */}
              {!session && (
                <div className="mt-8 p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-indigo-100 shadow-sm">
                  <p className="text-gray-700 mb-2 font-medium">Want to save books and get personalized recommendations?</p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => signIn('google')}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors group"
                  >
                    <FiLogIn size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                    Sign in with Google
                  </motion.button>
                </div>
              )}
            </div>

            <div className="md:col-span-5 relative">
              <div 
                ref={bookCardsRef} 
                className="relative h-[400px] w-full"
              >
                {/* Book card 1 */}
                <motion.div 
                  className="absolute top-0 left-[10%] w-48 h-64 bg-white rounded-2xl shadow-xl transform rotate-[-8deg] overflow-hidden border border-indigo-100"
                  whileHover={{ scale: 1.05, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center p-4 text-white font-bold text-center">
                    <div>
                      <FiBook size={32} className="mx-auto mb-2" />
                      <p>Science Fiction</p>
                    </div>
                  </div>
                </motion.div>
                
                {/* Book card 2 */}
                <motion.div 
                  className="absolute top-[15%] right-[10%] w-48 h-64 bg-white rounded-2xl shadow-xl transform rotate-[5deg] overflow-hidden border border-orange-100"
                  whileHover={{ scale: 1.05, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center p-4 text-white font-bold text-center">
                    <div>
                      <FiBook size={32} className="mx-auto mb-2" />
                      <p>Biographies</p>
                    </div>
                  </div>
                </motion.div>
                
                {/* Book card 3 */}
                <motion.div 
                  className="absolute bottom-[10%] left-[20%] w-48 h-64 bg-white rounded-2xl shadow-xl transform rotate-[12deg] overflow-hidden border border-purple-100"
                  whileHover={{ scale: 1.05, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center p-4 text-white font-bold text-center">
                    <div>
                      <FiBook size={32} className="mx-auto mb-2" />
                      <p>Fiction</p>
                    </div>
                  </div>
                </motion.div>
                
                {/* Decorative dots */}
                <div className="absolute -bottom-5 -right-5 w-24 h-24 grid grid-cols-3 grid-rows-3 gap-2">
                  {[...Array(9)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-2 h-2 rounded-full bg-indigo-300 opacity-70"
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection; 