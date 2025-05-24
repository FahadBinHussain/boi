'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiSearch, FiBook, FiLogIn } from 'react-icons/fi';
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const bookCardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create a master timeline for better sequence control
    const masterTl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => console.log("All hero animations complete")
    });
    
    // Main heading animation
    const heading = headingRef.current;
    const paragraph = paragraphRef.current;
    const buttons = buttonsRef.current;
    const bookCards = bookCardsRef.current;
    
    if (heading && paragraph && buttons && typeof window !== 'undefined') {
      // Instead of manipulating innerHTML directly, let's handle the text parts separately
      const mainText = "Discover and Download";
      const highlightedText = "Free Books";
      
      // Set up the HTML structure properly
      heading.innerHTML = ''; // Clear the heading
      heading.style.opacity = '1';
      
      // Create container for the main text part
      const mainTextContainer = document.createElement('span');
      
      // Create spans for each character in the main text
      mainText.split('').forEach(char => {
        const charSpan = document.createElement('span');
        charSpan.innerText = char === ' ' ? '\u00A0' : char; // Use non-breaking space for spaces
        charSpan.style.display = 'inline-block';
        charSpan.style.opacity = '0';
        mainTextContainer.appendChild(charSpan);
      });
      
      // Add the main text container
      heading.appendChild(mainTextContainer);
      
      // Add a space after the main text
      const spaceSpan = document.createElement('span');
      spaceSpan.innerHTML = '\u00A0';
      spaceSpan.style.display = 'inline-block';
      spaceSpan.style.opacity = '0';
      heading.appendChild(spaceSpan);
      
      // Create the styled span for highlighted text
      const highlightedSpan = document.createElement('span');
      highlightedSpan.className = 'text-indigo-600';
      
      // Create spans for each character in the highlighted text
      highlightedText.split('').forEach(char => {
        const charSpan = document.createElement('span');
        charSpan.innerText = char === ' ' ? '\u00A0' : char;
        charSpan.style.display = 'inline-block';
        charSpan.style.opacity = '0';
        highlightedSpan.appendChild(charSpan);
      });
      
      // Add the highlighted span to the heading
      heading.appendChild(highlightedSpan);
      
      // Animate all characters with staggered effect
      const allCharSpans = heading.querySelectorAll('span > span');
      
      // Add heading animation to timeline
      masterTl.to(allCharSpans, {
        opacity: 1,
        y: 0, 
        stagger: 0.03,
        duration: 0.4,
        ease: "power2.out",
        transformOrigin: "50% 50%",
        rotationY: 0
      }, 0)
      
      // Add paragraph animation
      .fromTo(paragraph, 
        { opacity: 0, y: 20 }, 
        { opacity: 1, y: 0, duration: 1 }, 
        0.5 // Start 0.5 seconds after the heading animation starts
      )
      
      // Add buttons animation with bounce effect
      .fromTo(buttons.querySelectorAll('a'), 
        { opacity: 0, y: 20 }, 
        { 
          opacity: 1, 
          y: 0, 
          stagger: 0.15, 
          duration: 0.7,
          ease: "back.out(1.7)" 
        }, 
        0.7 // Start 0.7 seconds after the heading animation starts
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
          0.9 // Start 0.9 seconds after the heading animation starts
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
    
    // Clean up function
    return () => {
      masterTl.kill();
      gsap.killTweensOf('.hero-gradient');
    };
  }, []);

  return (
    <div className="hero-gradient bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 py-16 sm:py-24 bg-[length:200%_100%]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 
              ref={headingRef}
              className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 leading-tight"
            >
              Discover and Download 
              <span className="text-indigo-600"> Free Books</span>
            </h1>
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
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors w-full sm:w-auto"
                >
                  <FiBook size={18} />
                  Browse Library
                </motion.button>
              </Link>
              
              <Link href="/categories" className="inline-block">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-900 font-medium py-3 px-6 rounded-lg border border-gray-300 transition-colors w-full sm:w-auto"
                >
                  <FiSearch size={18} />
                  Explore Categories
                </motion.button>
              </Link>
            </div>
            
            {/* Sign In Call to Action - Only shown when user is not logged in */}
            {!session && (
              <div className="mt-6">
                <p className="text-gray-600 mb-2">Want to save books and get personalized recommendations?</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => signIn('google')}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  <FiLogIn size={18} />
                  Sign in with Google
                </motion.button>
              </div>
            )}
          </div>

          <div
            className="relative hidden md:block"
          >
            <div 
              ref={bookCardsRef} 
              className="relative h-[400px] w-full"
            >
              <motion.div 
                className="absolute top-0 left-[10%] w-48 h-64 bg-white rounded-lg shadow-xl transform rotate-[-8deg] overflow-hidden"
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
              
              <motion.div 
                className="absolute top-[15%] right-[10%] w-48 h-64 bg-white rounded-lg shadow-xl transform rotate-[5deg] overflow-hidden"
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
              
              <motion.div 
                className="absolute bottom-[10%] left-[20%] w-48 h-64 bg-white rounded-lg shadow-xl transform rotate-[12deg] overflow-hidden"
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection; 