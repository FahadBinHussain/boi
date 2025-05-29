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
}

const BookCard = ({ book }: BookCardProps) => {
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
      className="group bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 transition-all duration-300 h-full flex flex-col"
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
      <div ref={imageRef} className="relative aspect-[2/3] w-full overflow-hidden">
        <Image
          src={book.coverImage}
          alt={`${book.title} cover`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
                className="flex items-center gap-2 bg-white text-gray-900 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors shadow-lg"
                whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                whileTap={{ scale: 0.95 }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ 
                  y: isHovered ? 0 : 20, 
                  opacity: isHovered ? 1 : 0,
                  transition: { delay: 0.1, duration: 0.3 }
                }}
              >
                <FiInfo size={16} />
                Details
              </motion.button>
            </Link>
            <a href={book.downloadLink}>
              <motion.button
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg"
                whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ 
                  y: isHovered ? 0 : 20, 
                  opacity: isHovered ? 1 : 0,
                  transition: { delay: 0.2, duration: 0.3 }
                }}
              >
                <FiDownload size={16} />
                Download
              </motion.button>
            </a>
          </div>
        </motion.div>
      </div>

      {/* Book Info */}
      <div className="p-4 flex flex-col flex-grow relative" style={{ transform: 'translateZ(10px)' }}>
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-indigo-600 transition-colors">{book.title}</h3>
        <p className="text-sm text-gray-600 mb-2">{book.author}</p>
        
        {/* Categories */}
        <div className="flex flex-wrap gap-1 mt-auto pt-2">
          {book.categories.slice(0, 2).map((category) => (
            <span 
              key={category} 
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors"
            >
              {category}
            </span>
          ))}
          {book.categories.length > 2 && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
              +{book.categories.length - 2}
            </span>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 bg-gray-50 text-xs text-gray-500 flex items-center justify-between group-hover:bg-indigo-50 transition-colors" style={{ transform: 'translateZ(5px)' }}>
        <span>{book.format}</span>
        <span>{book.fileSize}</span>
      </div>
    </motion.div>
  );
};

export default BookCard; 