'use client';

import { useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { FiLogIn, FiLogOut, FiUser, FiPlusCircle, FiLayout } from 'react-icons/fi';
import MotionIcon from '../ui/MotionIcon';
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
  const isAdmin = user?.role === 'ADMIN';

  if (status === 'loading') {
    // Show loading state
    return <div className="w-8 h-8 animate-pulse rounded-full bg-base-300"></div>;
  }

  if (session) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="btn btn-ghost btn-sm gap-2 normal-case font-normal text-base-content"
          aria-label="User menu"
        >
          <div className="avatar">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              {user?.image ? (
                <img 
                  src={user.image} 
                  alt={user.name || 'User avatar'} 
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <MotionIcon animation="bounce">
                  <FiUser className="text-primary" size={16} />
                </MotionIcon>
              )}
            </div>
          </div>
          <span className="hidden md:inline text-xs font-medium">
            {user?.name?.split(' ')[0] || 'User'}
          </span>
        </button>

        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 mt-2 w-52 bg-base-200 text-base-content rounded-box shadow-xl py-2 z-50 border border-base-300 menu menu-sm"
          >
            {/* Show different links based on user role */}
            {isAdmin ? (
              <Link 
                href="/admin" 
                className="flex items-center gap-2 px-4 py-2 hover:bg-base-300 rounded-lg text-sm"
                onClick={() => setIsDropdownOpen(false)}
              >
                <MotionIcon animation="pulse">
                  <FiLayout className="h-4 w-4 text-primary" />
                </MotionIcon>
                Admin Dashboard
              </Link>
            ) : (
              <Link 
                href="/admin/books/new" 
                className="flex items-center gap-2 px-4 py-2 hover:bg-base-300 rounded-lg text-sm"
                onClick={() => setIsDropdownOpen(false)}
              >
                <MotionIcon animation="spin">
                  <FiPlusCircle className="h-4 w-4 text-primary" />
                </MotionIcon>
                Add Book
              </Link>
            )}
            <Link 
              href="/profile" 
              className="flex items-center gap-2 px-4 py-2 hover:bg-base-300 rounded-lg text-sm"
              onClick={() => setIsDropdownOpen(false)}
            >
              <MotionIcon animation="wiggle">
                <FiUser className="h-4 w-4 text-primary" />
              </MotionIcon>
              Profile
            </Link>
            <button
              onClick={() => {
                signOut({ callbackUrl: '/' });
                setIsDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 text-error hover:bg-error/10 rounded-lg text-sm w-full text-left"
            >
              <MotionIcon animation="float">
                <FiLogOut className="h-4 w-4" />
              </MotionIcon>
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
      className="btn btn-ghost btn-sm gap-2 normal-case font-normal text-base-content hover:text-primary"
    >
      <MotionIcon animation="float">
        <FiLogIn size={18} />
      </MotionIcon>
      <span className="hidden md:inline text-xs font-medium">Sign in</span>
    </button>
  );
};

export default LoginButton;