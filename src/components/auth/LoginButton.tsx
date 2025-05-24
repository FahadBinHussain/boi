'use client';

import { useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { FiLogIn, FiLogOut, FiUser } from 'react-icons/fi';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Extend session user type to include role
type ExtendedUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
};

const LoginButton = () => {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Cast the user to include role
  const user = session?.user as ExtendedUser | undefined;

  if (status === 'loading') {
    // Show loading state
    return <div className="w-8 h-8 animate-pulse rounded-full bg-gray-200"></div>;
  }

  if (session) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-indigo-600 focus:outline-none"
          aria-label="User menu"
        >
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center">
            {user?.image ? (
              <img 
                src={user.image} 
                alt={user.name || 'User avatar'} 
                className="w-full h-full object-cover"
              />
            ) : (
              <FiUser className="text-indigo-600" size={18} />
            )}
          </div>
          <span className="hidden md:inline text-sm font-medium">
            {user?.name?.split(' ')[0] || 'User'}
          </span>
        </button>

        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200"
          >
            {user?.role === 'ADMIN' && (
              <Link 
                href="/admin" 
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setIsDropdownOpen(false)}
              >
                Admin Dashboard
              </Link>
            )}
            <Link 
              href="/profile" 
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsDropdownOpen(false)}
            >
              Profile
            </Link>
            <button
              onClick={() => {
                signOut({ callbackUrl: '/' });
                setIsDropdownOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn('google', { callbackUrl: '/' })}
      className="flex items-center space-x-2 text-gray-700 hover:text-indigo-600 transition-colors focus:outline-none"
    >
      <FiLogIn size={20} />
      <span className="hidden md:inline">Sign in</span>
    </button>
  );
};

export default LoginButton; 