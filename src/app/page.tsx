'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { FiArrowRight, FiBookOpen, FiClock, FiGrid, FiTrendingUp, FiChevronRight } from 'react-icons/fi';
import { genres as allGenres } from '@/lib/books';

type ApiBook = {
  id: string;
  title: string;
  author?: string;
  authors?: Array<{ name: string }>;
  imageUrl?: string;
  summary?: string;
  genres?: string[];
  publicationDate?: string;
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2
    }
  }
};

const fadeInUp = {
  hidden: { opacity: 0, y: 40, filter: 'blur(8px)' },
  show: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: {
      duration: 0.8
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  show: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: {
      duration: 0.7
    }
  }
};

export default function Home() {
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.98]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/books');
        if (!response.ok) throw new Error('Unable to load books right now.');
        const data = await response.json();
        setBooks(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load books right now.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const featured = useMemo(() => books.slice(0, 6), [books]);

  return (
    <div className="bg-[#0a0a0f] text-white selection:bg-[#14b8a6]/20 selection:text-[#5eead4]">
      {/* Noise overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03] mix-blend-overlay" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
      }} />

      {/* Hero section */}
      <section className="relative isolate min-h-[100dvh] overflow-hidden">
        {/* Depth layered background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0f1118] to-[#0a0a0f]" />
          
          {/* Gradient orbs */}
          <motion.div 
            animate={{ 
              x: [0, 30, 0],
              y: [0, -20, 0],
            }}
            transition={{ 
              duration: 20,
              repeat: Infinity
            }}
            className="absolute top-[10%] left-[5%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.12)_0%,transparent_65%)] blur-[80px]" 
          />
          <motion.div 
            animate={{ 
              x: [0, -40, 0],
              y: [0, 30, 0],
            }}
            transition={{ 
              duration: 25,
              repeat: Infinity,
              delay: 2
            }}
            className="absolute bottom-[20%] right-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.08)_0%,transparent_60%)] blur-[100px]" 
          />
          <motion.div 
            animate={{ 
              x: [0, 20, 0],
              y: [0, -40, 0],
            }}
            transition={{ 
              duration: 18,
              repeat: Infinity,
              delay: 1
            }}
            className="absolute top-[40%] right-[30%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.06)_0%,transparent_55%)] blur-[120px]" 
          />

          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_30%,transparent_70%)]" />
        </div>

        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative mx-auto grid max-w-[1480px] grid-cols-1 gap-16 px-6 pb-24 pt-28 lg:grid-cols-[1.1fr_0.9fr] lg:px-12 lg:pb-32 lg:pt-32"
        >
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className="flex flex-col justify-center"
          >
            <motion.div variants={fadeInUp} className="mb-8">
              <span className="inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2 text-xs tracking-[0.3em] text-white/60 backdrop-blur-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-[#14b8a6] animate-pulse" />
                NEXT GENERATION READING
              </span>
            </motion.div>
            
            <motion.h1 variants={fadeInUp} className="max-w-[14ch] font-[var(--font-geist-sans)] text-5xl font-semibold tracking-tighter lg:text-7xl xl:text-8xl">
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/70">Discover better books</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5eead4] via-[#14b8a6] to-[#0d9488]">with less noise.</span>
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="mt-8 max-w-[52ch] text-base leading-relaxed text-white/60 lg:text-lg">
              Built for focused readers. Cleaner discovery, faster browsing, and a modern library experience that helps you spend more time reading and less time searching.
            </motion.p>

            <motion.div variants={fadeInUp} className="mt-12 flex flex-wrap items-center gap-4">
              <Link href="/books" className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-white px-7 py-4 text-sm font-medium text-[#0a0a0f] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_0_60px_-15px_rgba(20,184,166,0.4)]">
                <span className="relative z-10">Browse collection</span>
                <FiArrowRight className="relative z-10 transition-transform duration-500 group-hover:translate-x-1" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#5eead4] to-[#14b8a6] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </Link>
              <Link href="/genres" className="inline-flex items-center gap-3 rounded-full border border-white/[0.12] bg-white/[0.03] px-7 py-4 text-sm font-medium text-white backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06]">
                Explore genres
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="relative"
          >
            <div className="grid grid-cols-2 gap-4 lg:gap-5">
              <motion.div 
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.4 }}
                className="rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#14b8a6]/20 to-[#14b8a6]/5 flex items-center justify-center mb-5">
                  <FiBookOpen className="text-xl text-[#5eead4]" />
                </div>
                <p className="font-[var(--font-geist-mono)] text-4xl font-light text-white">12k+</p>
                <p className="mt-2 text-sm text-white/50">Titles indexed</p>
              </motion.div>
              
              <motion.div 
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.4 }}
                className="translate-y-10 rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#a855f7]/20 to-[#a855f7]/5 flex items-center justify-center mb-5">
                  <FiTrendingUp className="text-xl text-[#c084fc]" />
                </div>
                <p className="font-[var(--font-geist-mono)] text-4xl font-light text-white">94%</p>
                <p className="mt-2 text-sm text-white/50">Return readers</p>
              </motion.div>
              
              <motion.div 
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.4 }}
                className="rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#3b82f6]/5 flex items-center justify-center mb-5">
                  <FiClock className="text-xl text-[#60a5fa]" />
                </div>
                <p className="font-[var(--font-geist-mono)] text-4xl font-light text-white">&lt;300ms</p>
                <p className="mt-2 text-sm text-white/50">Search response</p>
              </motion.div>
              
              <motion.div 
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.4 }}
                className="translate-y-10 rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#f59e0b]/20 to-[#f59e0b]/5 flex items-center justify-center mb-5">
                  <FiGrid className="text-xl text-[#fbbf24]" />
                </div>
                <p className="font-[var(--font-geist-mono)] text-4xl font-light text-white">38</p>
                <p className="mt-2 text-sm text-white/50">Genre clusters</p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30"
        >
          <span className="text-xs tracking-[0.2em]">SCROLL</span>
          <motion.div 
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <FiChevronRight className="rotate-90" />
          </motion.div>
        </motion.div>
      </section>

      {/* Featured section */}
      <section className="relative mx-auto max-w-[1480px] px-6 pb-32 lg:px-12">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-12 flex items-end justify-between gap-6 border-b border-white/[0.08] pb-6"
        >
          <div>
            <p className="mb-3 text-xs tracking-[0.25em] text-white/40">CURATED NOW</p>
            <h2 className="font-[var(--font-geist-sans)] text-3xl tracking-tight lg:text-4xl">Featured reading picks</h2>
          </div>
          <Link href="/books" className="group flex items-center gap-2 text-sm text-[#5eead4] transition hover:text-[#2dd4bf]">
            View all
            <FiArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[340px] animate-pulse rounded-[2rem] border border-white/[0.06] bg-white/[0.02]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-red-500/20 bg-red-500/10 p-8 text-red-400">{error}</div>
        ) : featured.length === 0 ? (
          <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-16 text-center text-white/50">
            No books are available yet. Add some books and refresh to populate this section.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((book, index) => {
              const author = book.author || book.authors?.[0]?.name || 'Unknown author';
              const cover = book.imageUrl || `https://picsum.photos/seed/${book.id}/720/1020`;
              const tag = book.genres?.[0] || 'General';

              return (
                <motion.article
                  key={book.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.7, delay: index * 0.08 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="group relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm shadow-[0_20px_60px_-25px_rgba(0,0,0,0.6)]"
                >
                  <div className="relative h-[220px] overflow-hidden">
                    <img 
                      src={cover} 
                      alt={book.title} 
                      className="h-full w-full object-cover transition-all duration-[1.2s] ease-out group-hover:scale-110" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#14b8a6]/10 to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
                    <span className="absolute left-5 top-5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">{tag}</span>
                  </div>
                  <div className="p-6">
                    <h3 className="line-clamp-1 font-[var(--font-geist-sans)] text-xl tracking-tight">{book.title}</h3>
                    <p className="mt-2 text-sm text-white/60">{author}</p>
                    <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-white/50">
                      {book.summary || 'A carefully selected title from our latest index, ready for your next deep reading session.'}
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {/* Genres section */}
      <section className="relative mx-auto max-w-[1480px] px-6 pb-32 lg:px-12">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 gap-8 border-t border-white/[0.08] pt-12 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div>
            <p className="mb-3 text-xs tracking-[0.25em] text-white/40">BROWSE BY MOOD</p>
            <h3 className="max-w-[16ch] font-[var(--font-geist-sans)] text-3xl tracking-tight lg:text-4xl">
              Structured genres. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5eead4] to-[#3b82f6]">Cleaner discovery.</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {allGenres.slice(0, 12).map((genre, i) => (
              <motion.div
                key={genre}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
                whileHover={{ y: -2, scale: 1.02 }}
              >
                <Link 
                  href={`/genres?selected=${genre}`} 
                  className="block rounded-[1.4rem] border border-white/[0.06] bg-white/[0.01] px-5 py-3.5 text-sm text-white/70 transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white"
                >
                  {genre}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9 }}
          className="mt-16 relative overflow-hidden rounded-[2.8rem] border border-white/[0.08] bg-gradient-to-br from-[#0f1118] to-[#0a0a0f]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(20,184,166,0.12)_0%,transparent_50%)]" />
          <div className="relative p-10 lg:p-16">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-4 text-xs tracking-[0.25em] text-[#5eead4]/80">START READING</p>
                <h4 className="max-w-[16ch] font-[var(--font-geist-sans)] text-3xl tracking-tight lg:text-5xl">
                  Build your next reading stack in minutes.
                </h4>
              </div>
              <Link href="/auth/signin" className="group inline-flex w-fit items-center gap-3 rounded-full bg-white px-8 py-4 text-sm font-medium text-[#0a0a0f] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_0_80px_-20px_rgba(255,255,255,0.3)]">
                Continue
                <FiArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
