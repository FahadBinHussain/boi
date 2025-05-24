'use client';

import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { FiLogIn } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const AuthCTA = () => {
  const { data: session } = useSession();
  const ctaSectionRef = useRef<HTMLElement>(null);
  const ctaContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ctaSectionRef.current) {
      // Create a gradient animation
      gsap.to(ctaSectionRef.current, {
        backgroundPosition: '100% 50%',
        duration: 15,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }

    if (ctaContentRef.current) {
      const elements = ctaContentRef.current.querySelectorAll('h2, p, a, button');
      
      // Animate content when scrolled into view
      gsap.from(elements, {
        y: 30,
        opacity: 0,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: ctaContentRef.current,
          start: 'top 80%',
        }
      });
    }
  }, []);

  // If the user is already logged in, show a different CTA
  if (session) {
    return (
      <section 
        ref={ctaSectionRef}
        className="py-20 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 bg-[length:200%_100%]"
      >
        <div 
          ref={ctaContentRef}
          className="container mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-sm">
            Welcome back, {session.user?.name?.split(' ')[0] || 'Reader'}!
          </h2>
          <p className="text-indigo-100 text-lg mb-8 max-w-2xl mx-auto">
            Continue your reading journey with personalized recommendations.
          </p>
          <Link 
            href="/books" 
            className="inline-block px-8 py-4 bg-white text-indigo-600 font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
          >
            My Library
          </Link>
        </div>
      </section>
    );
  }

  // For users who are not logged in
  return (
    <section 
      ref={ctaSectionRef}
      className="py-20 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 bg-[length:200%_100%]"
    >
      <div 
        ref={ctaContentRef}
        className="container mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-sm">
          Ready to start your reading journey?
        </h2>
        <p className="text-indigo-100 text-lg mb-8 max-w-2xl mx-auto">
          Join thousands of readers who discover new books every day on বই.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link 
            href="/books" 
            className="inline-block px-8 py-4 bg-white text-indigo-600 font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
          >
            Start Browsing
          </Link>
          
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => signIn('google')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-700 text-white font-bold rounded-lg hover:bg-indigo-800 transition-colors shadow-lg border border-indigo-500 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
          >
            <FiLogIn size={20} />
            Sign in with Google
          </motion.button>
        </div>
      </div>
    </section>
  );
};

export default AuthCTA; 