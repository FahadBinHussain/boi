'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiDownload, FiInfo } from 'react-icons/fi';
import MotionIcon from './MotionIcon';
import type { Book } from '@/lib/books';
import gsap from 'gsap';

interface BookCardProps {
  book: Book;
  compact?: boolean;
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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const xPercent = x / rect.width;
      const yPercent = y / rect.height;
      
      const rotateY = (xPercent - 0.5) * 10;
      const rotateX = (0.5 - yPercent) * 10;
      
      gsap.to(card, {
        rotateY: rotateY,
        rotateX: rotateX,
        transformPerspective: 1000,
        duration: 0.4,
        ease: 'power2.out',
      });
      
      gsap.to(image, {
        x: rotateY * 0.6,
        y: rotateX * 0.6,
        duration: 0.4,
        ease: 'power2.out',
      });
    };
    
    const handleMouseLeave = () => {
      gsap.to(card, {
        rotateY: 0,
        rotateX: 0,
        duration: 0.7,
        ease: 'elastic.out(1, 0.7)',
      });
      
      gsap.to(image, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: 'elastic.out(1, 0.7)',
      });
    };
    
    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <motion.div
      ref={cardRef}
      className={`group card bg-base-100 text-base-content border border-base-200 shadow-sm hover:shadow-xl rounded-2xl overflow-hidden transition-all duration-300 h-full flex flex-col ${
        compact ? 'max-w-[220px] mx-auto' : ''
      }`}
      whileHover={{ y: -5 }}
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
        className={`relative overflow-hidden bg-base-200 ${
          compact ? 'aspect-[2/3] w-full max-h-[250px]' : 'aspect-[2/3] w-full'
        }`}
      >
        <Image
          src={book.coverImage}
          alt={`${book.title} cover`}
          fill
          sizes={compact ? "(max-width: 640px) 33vw, 220px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
          className="transform group-hover:scale-105 transition-transform duration-500 object-cover"
          priority={false}
        />
        
        {/* Glow effect on hover */}
        <div 
          className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        />
        
        {/* Overlay on hover */}
        <motion.div 
          className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
        >
          <div className="flex flex-col gap-2.5 transform">
            <Link href={`/books/${book.id}`}>
              <motion.button
                className={`btn btn-sm bg-base-100 text-base-content hover:bg-base-200 border-none rounded-full shadow-lg ${
                  compact ? 'btn-xs text-xs' : ''
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ 
                  y: isHovered ? 0 : 20, 
                  opacity: isHovered ? 1 : 0,
                  transition: { delay: 0.1, duration: 0.3 }
                }}
              >
                <MotionIcon animation="bounce">
                  <FiInfo size={compact ? 13 : 15} />
                </MotionIcon>
                <span>Details</span>
              </motion.button>
            </Link>
            <a href={book.downloadLink}>
              <motion.button
                className={`btn btn-sm btn-primary rounded-full shadow-lg ${
                  compact ? 'btn-xs text-xs' : ''
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ 
                  y: isHovered ? 0 : 20, 
                  opacity: isHovered ? 1 : 0,
                  transition: { delay: 0.2, duration: 0.3 }
                }}
              >
                <MotionIcon animation="bounce">
                  <FiDownload size={compact ? 13 : 15} />
                </MotionIcon>
                <span>Download</span>
              </motion.button>
            </a>
          </div>
        </motion.div>
      </div>

      {/* Book Info */}
      <div className={`p-4 flex flex-col flex-grow relative ${compact ? 'p-3' : ''}`} style={{ transform: 'translateZ(10px)' }}>
        <h3 className={`font-bold text-base-content mb-1 line-clamp-1 group-hover:text-primary transition-colors ${
          compact ? 'text-sm' : 'text-base'
        }`}>
          {book.title}
        </h3>
        <p className={`text-sm text-base-content/70 mb-2 line-clamp-1 ${compact ? 'text-xs' : ''}`}>
          {book.author}
        </p>
        
        {/* Genres */}
        <div className="flex flex-wrap gap-1 mt-auto pt-2">
          {book.genres.slice(0, compact ? 1 : 2).map((genre) => (
            <span 
              key={genre} 
              className={`badge badge-sm badge-outline border-base-content/20 text-base-content/80 group-hover:badge-primary transition-colors ${
                compact ? 'text-[10px] px-1.5 py-0' : ''
              }`}
            >
              {genre}
            </span>
          ))}
          {book.genres.length > (compact ? 1 : 2) && (
            <span className={`badge badge-sm badge-ghost ${compact ? 'text-[10px] px-1 py-0' : ''}`}>
              +{book.genres.length - (compact ? 1 : 2)}
            </span>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div 
        className={`px-4 py-2.5 bg-base-200/50 border-t border-base-200 text-xs text-base-content/60 flex items-center justify-between ${
          compact ? 'px-3 py-1.5 text-[10px]' : ''
        }`} 
        style={{ transform: 'translateZ(5px)' }}
      >
        <span className="font-medium uppercase">{book.format}</span>
        <span>{book.fileSize}</span>
      </div>
    </motion.div>
  );
};

export default BookCard;