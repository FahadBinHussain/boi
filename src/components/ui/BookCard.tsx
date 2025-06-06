'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiDownload, FiInfo } from 'react-icons/fi';
import type { Book } from '@/lib/books';
import gsap from 'gsap';

interface BookCardProps {
  book: Book;
  compact?: boolean; // Add new prop to allow for a smaller display mode
}

const BookCard = ({ book, compact = false }: BookCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Create 3D tilt effect on hover
  useEffect(() => {
    const card = cardRef.current;
    const image = imageRef.current;
    
    if (!card || !image) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // x position within the element
      const y = e.clientY - rect.top; // y position within the element
      
      // Calculate rotation values based on mouse position
      // Convert positions to percentages
      const xPercent = x / rect.width;
      const yPercent = y / rect.height;
      
      // Calculate rotation (max rotation of 10 degrees)
      const rotateY = (xPercent - 0.5) * 10; // -5 to 5 degrees
      const rotateX = (0.5 - yPercent) * 10; // -5 to 5 degrees
      
      // Apply the rotation
      gsap.to(card, {
        rotateY: rotateY,
        rotateX: rotateX,
        transformPerspective: 1000,
        duration: 0.4,
        ease: 'power2.out',
      });
      
      // Move the image slightly for a parallax effect
      gsap.to(image, {
        x: rotateY * 0.6,
        y: rotateX * 0.6,
        duration: 0.4,
        ease: 'power2.out',
      });
    };
    
    const handleMouseLeave = () => {
      // Reset the rotation when mouse leaves
      gsap.to(card, {
        rotateY: 0,
        rotateX: 0,
        duration: 0.7,
        ease: 'elastic.out(1, 0.7)',
      });
      
      // Reset the image position
      gsap.to(image, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: 'elastic.out(1, 0.7)',
      });
    };
    
    // Add event listeners
    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);
    
    // Clean up event listeners
    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <motion.div
      ref={cardRef}
      className={`group bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 transition-all duration-300 h-full flex flex-col ${compact ? 'max-w-[220px] mx-auto' : ''}`}
      whileHover={{ 
        y: -5,
        boxShadow: '0 15px 30px rgba(0, 0, 0, 0.15), 0 10px 15px rgba(99, 102, 241, 0.1)',
        borderColor: '#e5e7eb'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        transformStyle: 'preserve-3d',
        transformOrigin: 'center center',
      }}
    >
      {/* Cover Image Container */}
      <div 
        ref={imageRef} 
        className={`relative overflow-hidden ${compact ? 'aspect-[2/3] w-full max-h-[250px]' : 'aspect-[2/3] w-full'}`}
      >
        <Image
          src={book.coverImage}
          alt={`${book.title} cover`}
          fill
          sizes={compact ? "(max-width: 640px) 33vw, 220px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
          className="transform group-hover:scale-105 transition-transform duration-300"
          style={{ 
            width: '100%', 
            height: '100%',
            objectFit: 'fill',
            objectPosition: 'center'
          }}
          priority={false}
        />
        
        {/* Glow effect on hover */}
        <div 
          className={`absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
        ></div>
        
        {/* Overlay on hover */}
        <motion.div 
          className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
        >
          <div className="flex flex-col gap-3 transform">
            <Link href={`/books/${book.id}`}>
              <motion.button
                className={`flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-lg ${compact ? 'text-xs px-3 py-1.5' : ''}`}
                whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                whileTap={{ scale: 0.95 }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ 
                  y: isHovered ? 0 : 20, 
                  opacity: isHovered ? 1 : 0,
                  transition: { delay: 0.1, duration: 0.3 }
                }}
              >
                <FiInfo size={compact ? 14 : 16} />
                Details
              </motion.button>
            </Link>
            <a href={book.downloadLink}>
              <motion.button
                className={`flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-lg ${compact ? 'text-xs px-3 py-1.5' : ''}`}
                whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ 
                  y: isHovered ? 0 : 20, 
                  opacity: isHovered ? 1 : 0,
                  transition: { delay: 0.2, duration: 0.3 }
                }}
              >
                <FiDownload size={compact ? 14 : 16} />
                Download
              </motion.button>
            </a>
          </div>
        </motion.div>
      </div>

      {/* Book Info */}
      <div className={`p-4 flex flex-col flex-grow relative ${compact ? 'p-3' : ''}`} style={{ transform: 'translateZ(10px)' }}>
        <h3 className={`font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${compact ? 'text-sm' : ''}`}>{book.title}</h3>
        <p className={`text-sm text-gray-600 dark:text-gray-400 mb-2 ${compact ? 'text-xs' : ''}`}>{book.author}</p>
        
        {/* Genres */}
        <div className="flex flex-wrap gap-1 mt-auto pt-2">
          {book.genres.slice(0, compact ? 1 : 2).map((genre) => (
            <span 
              key={genre} 
              className={`px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors ${compact ? 'text-[10px] px-1.5 py-0.5' : ''}`}
            >
              {genre}
            </span>
          ))}
          {book.genres.length > (compact ? 1 : 2) && (
            <span className={`px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors ${compact ? 'text-[10px] px-1.5 py-0.5' : ''}`}>
              +{book.genres.length - (compact ? 1 : 2)}
            </span>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className={`px-4 py-3 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors ${compact ? 'px-3 py-2 text-[10px]' : ''}`} style={{ transform: 'translateZ(5px)' }}>
        <span>{book.format}</span>
        <span>{book.fileSize}</span>
      </div>
    </motion.div>
  );
};

export default BookCard; 