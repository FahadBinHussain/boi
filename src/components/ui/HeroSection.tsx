'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiSearch, FiBook, FiLogIn } from 'react-icons/fi';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';

const HeroSection = () => {
  const { data: session } = useSession();

  return (
    <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Discover and Download 
              <span className="text-indigo-600"> Free Books</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-lg leading-relaxed">
              Access thousands of free books from various genres. Expand your knowledge and dive into new adventures without any cost.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/books" className="inline-block">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors w-full sm:w-auto"
                >
                  <FiBook size={18} />
                  Browse Library
                </motion.button>
              </Link>
              
              <Link href="/categories" className="inline-block">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative hidden md:block"
          >
            <div className="relative h-[400px] w-full">
              <motion.div 
                className="absolute top-0 left-[10%] w-48 h-64 bg-white rounded-lg shadow-xl transform rotate-[-8deg] overflow-hidden"
                whileHover={{ rotate: 0, scale: 1.05 }}
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
                whileHover={{ rotate: 0, scale: 1.05 }}
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
                whileHover={{ rotate: 0, scale: 1.05 }}
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
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection; 