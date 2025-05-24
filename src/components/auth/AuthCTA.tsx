'use client';

import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { FiLogIn } from 'react-icons/fi';
import { motion } from 'framer-motion';

const AuthCTA = () => {
  const { data: session } = useSession();

  // If the user is already logged in, show a different CTA
  if (session) {
    return (
      <section className="py-20 bg-indigo-600">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Welcome back, {session.user?.name?.split(' ')[0] || 'Reader'}!
          </h2>
          <p className="text-indigo-100 text-lg mb-8 max-w-2xl mx-auto">
            Continue your reading journey with personalized recommendations.
          </p>
          <Link 
            href="/books" 
            className="inline-block px-8 py-4 bg-white text-indigo-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
          >
            My Library
          </Link>
        </div>
      </section>
    );
  }

  // For users who are not logged in
  return (
    <section className="py-20 bg-indigo-600">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-6">
          Ready to start your reading journey?
        </h2>
        <p className="text-indigo-100 text-lg mb-8 max-w-2xl mx-auto">
          Join thousands of readers who discover new books every day on বই.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link 
            href="/books" 
            className="inline-block px-8 py-4 bg-white text-indigo-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Start Browsing
          </Link>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => signIn('google')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-700 text-white font-bold rounded-lg hover:bg-indigo-800 transition-colors"
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