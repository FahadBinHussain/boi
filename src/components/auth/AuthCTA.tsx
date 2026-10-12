'use client';

import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { FiLogIn } from 'react-icons/fi';
import MotionIcon from '../ui/MotionIcon';
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
        className="py-20 bg-base-200 border-y border-base-300 text-base-content"
      >
        <div 
          ref={ctaContentRef}
          className="container mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-black text-base-content mb-4">
            Welcome back, {session.user?.name?.split(' ')[0] || 'Reader'}!
          </h2>
          <p className="text-base-content/70 text-lg mb-8 max-w-2xl mx-auto">
            Continue your reading journey with personalized recommendations.
          </p>
          <Link 
            href="/books" 
            className="btn btn-primary btn-lg rounded-full px-10 shadow-lg"
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
      className="py-20 bg-base-200 border-y border-base-300 text-base-content"
    >
      <div 
        ref={ctaContentRef}
        className="container mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <h2 className="text-3xl md:text-4xl font-black text-base-content mb-4">
          Ready to start your reading journey?
        </h2>
        <p className="text-base-content/70 text-lg mb-8 max-w-2xl mx-auto">
          Join thousands of readers who discover new books every day on বই.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link 
            href="/books" 
            className="btn btn-primary btn-lg rounded-full px-8 shadow-lg"
          >
            Start Browsing
          </Link>
          
          <button
            onClick={() => signIn('google')}
            className="btn btn-neutral btn-lg rounded-full px-8 gap-2 shadow-lg"
          >
            <MotionIcon animation="bounce" trigger="hover">
              <FiLogIn size={20} />
            </MotionIcon>
            Sign in with Google
          </button>
        </div>
      </div>
    </section>
  );
};

export default AuthCTA; 