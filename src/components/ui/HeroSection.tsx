'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiSearch, FiArrowRight, FiDownload, FiBook, FiBookmark, FiLogIn } from 'react-icons/fi';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const HeroSection = () => {
  const { data: session } = useSession();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Handle mouse movement for the 3D effect
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!heroRef.current) return;
    
    const { clientX, clientY } = e;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width - 0.5;
    const y = (clientY - rect.top) / rect.height - 0.5;
    
    setMousePosition({ x, y });
  };
  
  useEffect(() => {
    // Mark component as loaded
    setIsLoaded(true);
    
    // Initial animations
    const tl = gsap.timeline();
    
    // Animate the background elements first
    tl.fromTo(".hero-bg-gradient", 
      { opacity: 0, scale: 0.8 }, 
      { opacity: 1, scale: 1, duration: 1.5, ease: "power3.out" }, 
      0
    );
    
    // Animate the decorative elements
    tl.fromTo(".hero-decoration", 
      { opacity: 0, scale: 0.5, rotation: -10 }, 
      { opacity: 1, scale: 1, rotation: 0, duration: 0.8, stagger: 0.1, ease: "back.out(1.7)" }, 
      0.3
    );
    
    // Animate the particles
    tl.fromTo(".hero-particle",
      { opacity: 0 },
      { opacity: 0.6, duration: 1.2, stagger: 0.02, ease: "power2.out" },
      0.5
    );
    
    // Animate the hero content (heading, text, buttons)
    tl.fromTo(".hero-content > *",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: "power2.out" },
      0.7
    );
    
    // Animate the showcase items
    tl.fromTo(".hero-showcase-item",
      { opacity: 0, y: 40, rotateX: 10, rotateY: -10 },
      { opacity: 1, y: 0, rotateX: 0, rotateY: 0, duration: 0.8, stagger: 0.15, ease: "back.out(1.7)" },
      1.0
    );
    
    // Set up continuous animations for floating elements
    gsap.to(".hero-float", {
      y: "random(-10, 10)",
      rotation: "random(-5, 5)",
      duration: "random(2, 4)",
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      stagger: {
        from: "random",
        amount: 1
      }
    });
    
    // Set up animation for the gradient background
    gsap.to(".hero-bg-gradient", {
      backgroundPosition: "100% 100%",
      duration: 15,
      ease: "none",
      repeat: -1,
      yoyo: true
    });
    
    // Clean up
    return () => {
      gsap.killTweensOf("*");
    };
  }, []);
  
  // Apply parallax effect based on mouse movement
  useEffect(() => {
    if (!isLoaded) return;
    
    gsap.to(".hero-parallax", {
      x: mousePosition.x * 20,
      y: mousePosition.y * 20,
      rotateY: mousePosition.x * 5,
      rotateX: mousePosition.y * -5,
      duration: 1,
      ease: "power2.out"
    });
    
    gsap.to(".hero-parallax-reverse", {
      x: mousePosition.x * -15,
      y: mousePosition.y * -15,
      rotateY: mousePosition.x * -3,
      rotateX: mousePosition.y * 3,
      duration: 1,
      ease: "power2.out"
    });
    
    gsap.to(".hero-heading", {
      x: mousePosition.x * -25,
      y: mousePosition.y * -10,
      duration: 1,
      ease: "power2.out"
    });
    
    gsap.to(".hero-showcase", {
      rotateY: mousePosition.x * 5,
      rotateX: mousePosition.y * -5,
      duration: 1,
      ease: "power2.out"
    });
  }, [mousePosition, isLoaded]);

  return (
    <div 
      ref={heroRef}
      className="relative w-full h-screen overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Animated background */}
      <div 
        className="hero-bg-gradient absolute inset-0 bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950"
        style={{
          backgroundSize: "200% 200%",
          backgroundPosition: "0% 0%"
        }}
      ></div>
      
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }}
        ></div>
      </div>
      
      {/* Glowing orbs in background */}
      <div className="hero-decoration hero-float absolute -top-[5%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/20 blur-[120px] mix-blend-screen"></div>
      <div className="hero-decoration hero-float absolute -bottom-[20%] -right-[10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/20 blur-[100px] mix-blend-screen"></div>
      <div className="hero-decoration hero-float absolute top-[30%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-pink-600/10 blur-[80px] mix-blend-screen hero-parallax"></div>
      
      {/* Decorative geometric elements */}
      <div className="hero-decoration hero-float hero-parallax absolute top-[15%] right-[10%] w-[180px] h-[180px] border border-white/10 rounded-2xl backdrop-blur-sm bg-white/5 rotate-12 shadow-xl"></div>
      <div className="hero-decoration hero-float hero-parallax-reverse absolute bottom-[20%] left-[5%] w-[150px] h-[150px] border border-white/10 rounded-full backdrop-blur-sm bg-white/5 shadow-xl"></div>
      <div className="hero-decoration hero-float hero-parallax absolute top-[35%] left-[8%] w-[120px] h-[120px] border border-white/10 rounded-lg backdrop-blur-sm bg-white/5 rotate-45 shadow-xl"></div>
      <div className="hero-decoration hero-float hero-parallax-reverse absolute bottom-[12%] right-[15%] w-[100px] h-[100px] border border-white/10 rounded-3xl backdrop-blur-sm bg-white/5 -rotate-12 shadow-xl"></div>
      
      {/* Floating particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div 
          key={i}
          className="hero-particle absolute rounded-full"
          style={{
            width: `${Math.random() * 6 + 2}px`,
            height: `${Math.random() * 6 + 2}px`,
            background: i % 3 === 0 ? 'rgba(139, 92, 246, 0.7)' : 
                      i % 3 === 1 ? 'rgba(99, 102, 241, 0.7)' : 
                      'rgba(244, 114, 182, 0.7)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            boxShadow: i % 3 === 0 ? '0 0 15px rgba(139, 92, 246, 0.5)' : 
                       i % 3 === 1 ? '0 0 15px rgba(99, 102, 241, 0.5)' : 
                       '0 0 15px rgba(244, 114, 182, 0.5)'
          }}
        ></div>
      ))}
      
      {/* Main content */}
      <div className="container mx-auto h-full relative z-10 px-4 lg:px-8">
        <div className="flex flex-col lg:flex-row h-full items-center">
          {/* Hero text content */}
          <div ref={contentRef} className="hero-content w-full lg:w-1/2 pt-20 lg:pt-0">
            <motion.h1 
              className="hero-heading text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight"
            >
              <span className="block">Discover a World</span>
              <span className="block">of Knowledge</span>
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Through Books</span>
            </motion.h1>
            
            <motion.p className="text-xl text-indigo-100 font-medium mb-4 max-w-lg">
              Your gateway to a vast collection of free books, ready to expand your mind and imagination
            </motion.p>
            
            <motion.p className="text-lg text-indigo-200/80 mb-8 max-w-lg">
              Access thousands of books across various genres, download them for free, and embark on a journey of discovery and learning.
            </motion.p>
            
            <div className="flex flex-col sm:flex-row gap-5 mb-10">
              <Link 
                href="/books" 
                className="group relative overflow-hidden rounded-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 group-hover:from-violet-700 group-hover:to-indigo-700 transition-all duration-500"></div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-30 bg-white/20 translate-y-full group-hover:translate-y-0 transition-all duration-700"></div>
                <div className="absolute -inset-px bg-gradient-to-r from-pink-500/50 to-indigo-500/50 opacity-0 group-hover:opacity-100 rounded-xl blur transition-all duration-1000 group-hover:duration-500"></div>
                <div className="relative px-7 py-3.5 flex items-center gap-2">
                  <FiBook className="text-white" size={18} />
                  <span className="font-medium text-white">Explore Library</span>
                  <FiArrowRight className="text-white transform group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </Link>
              
              <Link 
                href="/categories" 
                className="group relative overflow-hidden rounded-xl"
              >
                <div className="absolute inset-0 bg-white/10 backdrop-blur-md border border-white/20 group-hover:bg-white/15 transition-all duration-500"></div>
                <div className="absolute -inset-px bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 rounded-xl blur transition-all duration-700"></div>
                <div className="relative px-7 py-3.5 flex items-center gap-2">
                  <FiSearch className="text-white" size={18} />
                  <span className="font-medium text-white">Browse Categories</span>
                </div>
              </Link>
            </div>
            
            {/* Authentication CTA */}
            {!session && (
              <motion.div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5 max-w-md shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <FiBookmark className="text-white" size={18} />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-2">Create your personal library</p>
                    <p className="text-indigo-200/70 text-sm mb-3">Sign in to save your favorite books, track your reading progress and get personalized recommendations.</p>
                    <button
                      onClick={() => signIn('google')}
                      className="flex items-center gap-2 text-indigo-300 hover:text-white font-medium transition-colors group"
                    >
                      <FiLogIn size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                      <span>Sign in with Google</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
          
          {/* 3D Book Showcase */}
          <div className="w-full lg:w-1/2 hidden lg:block h-full relative">
            <div className="hero-showcase absolute inset-0 perspective-[1200px]">
              {/* Central hovering display */}
              <div className="hero-showcase-item absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="relative w-[280px]">
                  {/* Main featured book */}
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl transform -rotate-3 transition-transform duration-300 hover:rotate-0">
                    <div className="aspect-[2/3] bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center p-6">
                      <div className="text-center text-white">
                        <div className="w-20 h-20 rounded-full bg-white/20 mx-auto mb-5 flex items-center justify-center">
                          <FiBook size={32} className="text-white" />
                        </div>
                        <h3 className="text-2xl font-bold mb-3">Science Fiction</h3>
                        <p className="text-white/80">Explore futuristic worlds and mind-bending concepts</p>
                      </div>
                    </div>
                    {/* Book shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-50"></div>
                  </div>
                  {/* Book shadow */}
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-[80%] h-[20px] bg-black/40 blur-xl rounded-full"></div>
                </div>
              </div>
              
              {/* Orbit elements - floating books and decorative items */}
              <div className="hero-showcase-item hero-float absolute top-[20%] right-[15%] transform rotate-6 z-10">
                <div className="relative w-[180px]">
                  <div className="rounded-2xl overflow-hidden shadow-xl">
                    <div className="aspect-[2/3] bg-gradient-to-br from-pink-600 to-purple-700 flex items-center justify-center p-5">
                      <div className="text-center text-white">
                        <div className="w-14 h-14 rounded-full bg-white/20 mx-auto mb-4 flex items-center justify-center">
                          <FiBook size={24} className="text-white" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Biography</h3>
                        <p className="text-sm text-white/80">Real stories of extraordinary people</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-[80%] h-[15px] bg-black/30 blur-lg rounded-full"></div>
                </div>
              </div>
              
              <div className="hero-showcase-item hero-float absolute bottom-[25%] left-[20%] transform -rotate-6 z-10">
                <div className="relative w-[200px]">
                  <div className="rounded-2xl overflow-hidden shadow-xl">
                    <div className="aspect-[2/3] bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center p-5">
                      <div className="text-center text-white">
                        <div className="w-14 h-14 rounded-full bg-white/20 mx-auto mb-4 flex items-center justify-center">
                          <FiBook size={24} className="text-white" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Psychology</h3>
                        <p className="text-sm text-white/80">Understand the human mind</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-[80%] h-[15px] bg-black/30 blur-lg rounded-full"></div>
                </div>
              </div>
              
              {/* Stats card */}
              <div className="hero-showcase-item hero-float absolute bottom-[15%] right-[20%] z-10">
                <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-5 shadow-xl w-[200px]">
                  <div className="text-white">
                    <h4 className="text-lg font-medium mb-3">Library Stats</h4>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white/80 text-sm">Books Available</span>
                      <span className="font-bold">12K+</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white/80 text-sm">Categories</span>
                      <span className="font-bold">48+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-sm">Downloads</span>
                      <span className="font-bold">2M+</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Download label */}
              <div className="hero-showcase-item hero-float absolute top-[40%] left-[30%] z-10">
                <div className="bg-white/10 backdrop-blur-lg rounded-full border border-white/20 px-5 py-2.5 shadow-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                    <FiDownload size={16} className="text-white" />
                  </div>
                  <span className="text-white font-medium">Free Downloads</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center animate-bounce">
        <div className="text-white/70 text-sm mb-2">Scroll to explore</div>
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-center justify-center">
          <div className="w-1.5 h-3 bg-white/50 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;