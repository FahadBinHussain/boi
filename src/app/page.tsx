'use client';

import { genres } from '@/lib/books';
import HeroSection from '@/components/ui/HeroSection';
import BookGrid from '@/components/ui/BookGrid';
import { FiBookOpen, FiDownload, FiUsers, FiLogIn, FiLoader } from 'react-icons/fi';
import Link from 'next/link';
import AuthCTA from '@/components/auth/AuthCTA';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Book } from '@/lib/books';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function Home() {
  // State for books
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch books from the API
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/books');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch books: ${response.statusText}`);
        }
        
        const data = await response.json();
        setBooks(data);
      } catch (err) {
        console.error('Error fetching books:', err);
        setError('Failed to load books. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBooks();
  }, []);

  // Featured books - just take the first 3 for the homepage
  const featuredBooks = books.slice(0, 3);
  
  const featuresHeaderRef = useRef<HTMLDivElement>(null);
  const featureBoxesRef = useRef<HTMLDivElement>(null);
  const featuredSectionRef = useRef<HTMLElement>(null);
  const genreHeaderRef = useRef<HTMLDivElement>(null);
  const genresRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Features section animations with timeline
    if (featuresHeaderRef.current) {
      const featuresTl = gsap.timeline({
        scrollTrigger: {
          trigger: featuresHeaderRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });
      
      featuresTl
        .from(featuresHeaderRef.current.querySelector('h2'), {
          opacity: 0,
          y: 30,
          duration: 0.8,
          ease: "power2.out"
        })
        .from(featuresHeaderRef.current.querySelector('p'), {
          opacity: 0,
          y: 20,
          duration: 0.8,
          ease: "power2.out"
        }, "-=0.4"); // Start slightly before the previous animation finishes
    }
    
    // Feature boxes animation with staggered 3D reveal
    if (featureBoxesRef.current) {
      const boxes = featureBoxesRef.current.querySelectorAll('.feature-box');
      const featureBoxesTl = gsap.timeline({
        scrollTrigger: {
          trigger: featureBoxesRef.current,
          start: "top 75%",
          toggleActions: "play none none reverse"
        }
      });
      
      // Create a staggered reveal with 3D effect
      featureBoxesTl.fromTo(
        boxes,
        { 
          opacity: 0,
          y: 80,
          scale: 0.9,
          rotationX: 10,
          transformPerspective: 800,
          transformOrigin: "center bottom"
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotationX: 0,
          stagger: 0.15,
          duration: 1,
          ease: "power3.out",
          clearProps: "all"
        }
      );
      
      // Parallax effect for the icons
      boxes.forEach((box) => {
        const icon = box.querySelector('.w-16');
        
        // Create parallax scroll effect for each icon
        if (icon) {
          ScrollTrigger.create({
            trigger: box,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
            onUpdate: (self) => {
              gsap.to(icon, {
                y: (1 - self.progress) * 15,
                duration: 0.5,
                ease: "none"
              });
            }
          });
        }
      });
      
      // Add hover animations to feature boxes with morph effect
      boxes.forEach((box: Element) => {
        const initialBgColor = 'rgb(249, 250, 251)'; // bg-gray-50
        const hoverBgColor = 'rgb(238, 242, 255)'; // bg-indigo-50
        
        box.addEventListener('mouseenter', () => {
          gsap.to(box, { 
            y: -12, 
            scale: 1.05,
            backgroundColor: hoverBgColor,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -6px rgba(0,0,0,0.05)',
            duration: 0.3,
            ease: "power2.out",
            overwrite: true,
          });
          
          // Animate the icon
          const icon = box.querySelector('.w-16');
          if (icon) {
            gsap.to(icon, {
              scale: 1.2,
              rotation: 5,
              backgroundColor: 'rgb(224, 231, 255)', // Lighter indigo
              duration: 0.4,
              ease: "back.out(1.7)"
            });
          }
        });
        
        box.addEventListener('mouseleave', () => {
          gsap.to(box, { 
            y: 0, 
            scale: 1,
            backgroundColor: initialBgColor,
            boxShadow: '0 0 0 0 rgba(0,0,0,0)',
            duration: 0.5,
            ease: "power2.out",
            overwrite: true,
          });
          
          // Reset the icon
          const icon = box.querySelector('.w-16');
          if (icon) {
            gsap.to(icon, {
              scale: 1,
              rotation: 0,
              backgroundColor: 'rgb(238, 242, 255)', // bg-indigo-100
              duration: 0.3,
              ease: "power2.inOut"
            });
          }
        });
      });
    }
    
    // Featured section animations with enhanced effects
    if (featuredSectionRef.current) {
      const header = featuredSectionRef.current.querySelector('h2');
      const description = featuredSectionRef.current.querySelector('p');
      const link = featuredSectionRef.current.querySelector('a');
      const bookGrid = featuredSectionRef.current.querySelector('div[class*="grid"]');
      
      if (header && description && link && bookGrid) {
        // Create a timeline for the featured section
        const featuredTl = gsap.timeline({
          scrollTrigger: {
            trigger: featuredSectionRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse"
          }
        });
        
        // Add title and description reveal with clip path
        featuredTl
          .fromTo([header, description], 
            {
              clipPath: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)",
              opacity: 0,
              x: -30
            },
            {
              clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
              opacity: 1,
              x: 0,
              stagger: 0.15,
              duration: 1,
              ease: "power3.out"
            }
          )
          .fromTo(link,
            { opacity: 0, x: -20 },
            { opacity: 1, x: 0, duration: 0.7, ease: "power2.out" },
            "-=0.5"
          );
        
        // Add a cooler entrance for the book grid
        if (bookGrid) {
          const bookItems = bookGrid.querySelectorAll('div[class*="motion"]');
          
          featuredTl.fromTo(bookItems,
            {
              opacity: 0,
              y: 60,
              scale: 0.9,
              transformOrigin: "bottom center",
              filter: "blur(5px)"
            },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              stagger: 0.1,
              duration: 0.8,
              filter: "blur(0px)",
              ease: "back.out(1.2)"
            },
            "-=0.3" // Slight overlap
          );
          
          // Add subtle parallax effect on scroll
          bookItems.forEach((item) => {
            ScrollTrigger.create({
              trigger: item,
              start: "top bottom",
              end: "bottom top",
              scrub: 1.5,
              onUpdate: (self) => {
                gsap.to(item, {
                  y: (self.progress - 0.5) * 20, // Move up as we scroll down
                  duration: 0.5
                });
              }
            });
          });
        }
      }
    }
    
    // Categories animations with enhanced staggered reveal
    if (genreHeaderRef.current) {
      const genreHeaderTl = gsap.timeline({
        scrollTrigger: {
          trigger: genreHeaderRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });
      
      // Animate the header with a mask reveal effect
      genreHeaderTl
        .fromTo(genreHeaderRef.current.querySelector('h2'),
          { 
            opacity: 0, 
            y: 20,
            clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)" 
          },
          { 
            opacity: 1, 
            y: 0, 
            clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
            duration: 0.8,
            ease: "power2.out" 
          }
        )
        .fromTo(genreHeaderRef.current.querySelector('p'),
          { 
            opacity: 0, 
            y: 20 
          },
          { 
            opacity: 1, 
            y: 0, 
            duration: 0.8,
            ease: "power2.out" 
          },
          "-=0.5"
        );
    }
    
    // Category boxes animation with floating effect
    if (genresRef.current) {
      const categoryItems = genresRef.current.querySelectorAll('a');
      
      // Create a timeline for categories
      const categoriesTl = gsap.timeline({
        scrollTrigger: {
          trigger: genresRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });
      
      // Animate categories with a grid reveal effect
      categoriesTl.fromTo(categoryItems,
        { 
          opacity: 0, 
          y: 30,
          scale: 0.95,
          stagger: {
            grid: [2, 4], // Assumes 2 rows, 4 columns
            from: "center",
            amount: 0.4
          }
        },
        { 
          opacity: 1, 
          y: 0,
          scale: 1,
          stagger: {
            grid: [2, 4],
            from: "center",
            amount: 0.4
          },
          duration: 0.7,
          ease: "power2.out"
        }
      );
      
      // Create a floating animation for categories
      categoryItems.forEach((item, index) => {
        // Create a subtle hover float effect
        gsap.to(item, {
          y: (index % 2 === 0) ? -5 : -8,
          duration: 1.5 + (index % 3) * 0.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
        
        // Enhanced hover effect
        item.addEventListener('mouseenter', () => {
          gsap.to(item, { 
            backgroundColor: 'rgb(238, 242, 255)', // bg-indigo-50
            scale: 1.05, 
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            duration: 0.3,
            overwrite: "auto"
          });
          
          // Animate the category text
          const categoryText = item.querySelector('h3');
          if (categoryText) {
            gsap.to(categoryText, {
              color: 'rgb(79, 70, 229)', // text-indigo-600
              fontWeight: 700,
              duration: 0.3
            });
          }
        });
        
        item.addEventListener('mouseleave', () => {
          gsap.to(item, { 
            backgroundColor: 'rgb(249, 250, 251)', // bg-gray-50
            scale: 1,
            boxShadow: '0 0 0 0 rgba(0,0,0,0)',
            duration: 0.5
          });
          
          // Reset the category text
          const categoryText = item.querySelector('h3');
          if (categoryText) {
            gsap.to(categoryText, {
              color: 'rgb(17, 24, 39)', // text-gray-900
              fontWeight: 500,
              duration: 0.3
            });
          }
        });
      });
    }

    // Cleanup function to prevent memory leaks
    return () => {
      // Kill all ScrollTrigger instances to prevent memory leaks
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
      
      // Kill all GSAP animations
      gsap.killTweensOf('*');
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div 
            className="text-center mb-12"
            ref={featuresHeaderRef}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why বই?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We provide a simple, fast, and user-friendly platform to discover and download free books.
            </p>
          </div>

          <div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10"
            ref={featureBoxesRef}
          >
            {/* Feature 1 */}
            <div className="feature-box bg-gray-50 p-6 rounded-lg text-center transform transition-all duration-300 relative z-10">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                <FiBookOpen size={28} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Wide Selection</h3>
              <p className="text-gray-600">
                Access thousands of books across various genres.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="feature-box bg-gray-50 p-6 rounded-lg text-center transform transition-all duration-300 relative z-10">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                <FiDownload size={28} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Easy Downloads</h3>
              <p className="text-gray-600">
                Simple one-click downloads in multiple formats including PDF, EPUB, and MOBI.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="feature-box bg-gray-50 p-6 rounded-lg text-center transform transition-all duration-300 relative z-10">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                <FiUsers size={28} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Community Driven</h3>
              <p className="text-gray-600">
                Join a community of book lovers who share and review their favorite reads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Books Section */}
      <section className="py-16 bg-gray-50" ref={featuredSectionRef}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Books</h2>
              <p className="text-lg text-gray-600">
                Check out our most popular books this week
              </p>
            </div>
            <Link 
              href="/books" 
              className="inline-block mt-4 md:mt-0 text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
            >
              View all books →
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-lg text-gray-600">Loading featured books...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
              <p className="font-medium">{error}</p>
              <p className="mt-1 text-sm">Please try refreshing the page or contact support if the problem persists.</p>
            </div>
          ) : (
            <BookGrid books={featuredBooks} selectedGenres={[]} compact={true} />
          )}
        </div>
      </section>

      {/* Categories Preview */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div 
            className="text-center mb-12"
            ref={genreHeaderRef}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Explore Genres</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Find your next read by browsing our collection by genre
            </p>
          </div>

          <div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            ref={genresRef}
          >
            {genres.slice(0, 8).map((genre) => (
              <Link 
                key={genre} 
                href={`/genres?selected=${genre}`}
                className="bg-gray-50 hover:bg-indigo-50 border border-gray-200 rounded-lg p-6 text-center transition-colors group"
              >
                <h3 className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {genre}
                </h3>
              </Link>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <Link 
              href="/genres" 
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              View All Genres
            </Link>
          </div>
        </div>
      </section>

      {/* Auth CTA Section */}
      <AuthCTA />
    </div>
  );
}

