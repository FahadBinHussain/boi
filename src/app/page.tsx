'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { FiArrowRight, FiChevronRight } from 'react-icons/fi';
import MotionIcon from '@/components/ui/MotionIcon';
import { BookOpenIcon, TrendingUpIcon, ClockIcon, GridIcon, type AnimatedIconHandle } from '@/components/ui/AnimatedLandingIcons';
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

export default function Home() {
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statRefs = useRef<(AnimatedIconHandle | null)[]>([]);
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
    <div className="bg-base-100 text-base-content selection:bg-primary/20 selection:text-primary transition-colors">
      {/* Noise overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03] mix-blend-overlay" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }} 
      />

      {/* Hero section */}
      <section className="relative isolate min-h-[90dvh] overflow-hidden">
        {/* Depth layered background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-base-100 via-base-200/50 to-base-100" />
          
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
            className="absolute top-[10%] left-[5%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[90px]" 
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
            className="absolute bottom-[20%] right-[10%] h-[450px] w-[450px] rounded-full bg-secondary/10 blur-[100px]" 
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
            className="absolute top-[40%] right-[30%] h-[350px] w-[350px] rounded-full bg-accent/10 blur-[110px]" 
          />

          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] opacity-[0.03] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_30%,transparent_70%)]" />
        </div>

        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative mx-auto grid max-w-[1480px] grid-cols-1 gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-12 lg:pb-32 lg:pt-28"
        >
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className="flex flex-col justify-center"
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <span className="badge badge-outline gap-2 px-4 py-3 border-base-content/20 bg-base-200/60 text-base-content/80 text-xs font-semibold tracking-[0.25em] uppercase">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Next Generation Reading
              </span>
            </motion.div>
            
            <motion.h1 variants={fadeInUp} className="max-w-[14ch] text-5xl font-extrabold tracking-tight lg:text-7xl xl:text-8xl">
              <span className="text-base-content">Discover better books</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent">with less noise.</span>
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="mt-6 max-w-[52ch] text-base leading-relaxed text-base-content/70 lg:text-lg">
              Built for focused readers. Cleaner discovery, faster browsing, and a modern library experience that helps you spend more time reading and less time searching.
            </motion.p>

            <motion.div variants={fadeInUp} className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/books" className="btn btn-primary rounded-full px-8 gap-2 font-medium shadow-lg hover:shadow-xl transition-all">
                <span>Browse collection</span>
                <MotionIcon animation="float" trigger="hover">
                  <FiArrowRight />
                </MotionIcon>
              </Link>
              <Link href="/genres" className="btn btn-outline rounded-full px-8 font-medium">
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
                onMouseEnter={() => statRefs.current[0]?.startAnimation()}
                onMouseLeave={() => statRefs.current[0]?.stopAnimation()}
                transition={{ duration: 0.4 }}
                className="card bg-base-200/70 border border-base-content/10 p-6 backdrop-blur-xl shadow-xl rounded-3xl"
              >
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                  <BookOpenIcon ref={(el) => { statRefs.current[0] = el; }} className="text-xl text-primary" />
                </div>
                <p className="font-mono text-4xl font-bold text-base-content">12k+</p>
                <p className="mt-2 text-sm text-base-content/60">Titles indexed</p>
              </motion.div>
              
              <motion.div 
                whileHover={{ y: -4, scale: 1.02 }}
                onMouseEnter={() => statRefs.current[1]?.startAnimation()}
                onMouseLeave={() => statRefs.current[1]?.stopAnimation()}
                transition={{ duration: 0.4 }}
                className="translate-y-8 card bg-base-200/70 border border-base-content/10 p-6 backdrop-blur-xl shadow-xl rounded-3xl"
              >
                <div className="h-12 w-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-5">
                  <TrendingUpIcon ref={(el) => { statRefs.current[1] = el; }} className="text-xl text-secondary" />
                </div>
                <p className="font-mono text-4xl font-bold text-base-content">94%</p>
                <p className="mt-2 text-sm text-base-content/60">Return readers</p>
              </motion.div>
              
              <motion.div 
                whileHover={{ y: -4, scale: 1.02 }}
                onMouseEnter={() => statRefs.current[2]?.startAnimation()}
                onMouseLeave={() => statRefs.current[2]?.stopAnimation()}
                transition={{ duration: 0.4 }}
                className="card bg-base-200/70 border border-base-content/10 p-6 backdrop-blur-xl shadow-xl rounded-3xl"
              >
                <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
                  <ClockIcon ref={(el) => { statRefs.current[2] = el; }} className="text-xl text-accent" />
                </div>
                <p className="font-mono text-4xl font-bold text-base-content">&lt;300ms</p>
                <p className="mt-2 text-sm text-base-content/60">Search response</p>
              </motion.div>
              
              <motion.div 
                whileHover={{ y: -4, scale: 1.02 }}
                onMouseEnter={() => statRefs.current[3]?.startAnimation()}
                onMouseLeave={() => statRefs.current[3]?.stopAnimation()}
                transition={{ duration: 0.4 }}
                className="translate-y-8 card bg-base-200/70 border border-base-content/10 p-6 backdrop-blur-xl shadow-xl rounded-3xl"
              >
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                  <GridIcon ref={(el) => { statRefs.current[3] = el; }} className="text-xl text-primary" />
                </div>
                <p className="font-mono text-4xl font-bold text-base-content">38</p>
                <p className="mt-2 text-sm text-base-content/60">Genre clusters</p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-base-content/40"
        >
          <span className="text-[10px] tracking-[0.25em] font-semibold uppercase">Scroll</span>
          <motion.div 
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <MotionIcon animation="bounce" trigger="always">
              <FiChevronRight className="rotate-90 text-sm" />
            </MotionIcon>
          </motion.div>
        </motion.div>
      </section>

      {/* Featured section */}
      <section className="relative mx-auto max-w-[1480px] px-6 pb-28 lg:px-12">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-10 flex items-end justify-between gap-6 border-b border-base-content/10 pb-6"
        >
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.25em] uppercase text-primary">Curated Now</p>
            <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl text-base-content">Featured reading picks</h2>
          </div>
          <Link href="/books" className="btn btn-ghost btn-sm text-primary gap-1">
            <span>View all</span>
            <MotionIcon animation="float" trigger="hover">
              <FiArrowRight />
            </MotionIcon>
          </Link>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-[340px] animate-pulse bg-base-200 rounded-3xl border border-base-content/5" />
            ))}
          </div>
        ) : error ? (
          <div className="alert alert-error rounded-3xl shadow-lg">
            <span>{error}</span>
          </div>
        ) : featured.length === 0 ? (
          <div className="card bg-base-200 border border-base-content/10 p-16 text-center text-base-content/60 rounded-3xl">
            No books are available yet. Add some books and refresh to populate this section.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="card bg-base-200 border border-base-content/10 shadow-lg hover:shadow-2xl overflow-hidden rounded-3xl group transition-all"
                >
                  <div className="relative h-[220px] overflow-hidden bg-base-300">
                    <img 
                      src={cover} 
                      alt={book.title} 
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-base-300/80 via-transparent to-transparent" />
                    <span className="badge badge-primary absolute left-4 top-4 text-xs font-semibold shadow-md">
                      {tag}
                    </span>
                  </div>
                  <div className="card-body p-6">
                    <h3 className="card-title text-lg font-bold line-clamp-1 text-base-content">{book.title}</h3>
                    <p className="text-sm text-base-content/70">{author}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-base-content/60">
                      {book.summary || 'A carefully selected title from our latest index, ready for your next deep reading session.'}
                    </p>
                    <div className="card-actions justify-end mt-4">
                      <Link href={`/books/${book.id}`} className="btn btn-primary btn-sm rounded-btn">
                        Read Details
                      </Link>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {/* Genres section */}
      <section className="relative mx-auto max-w-[1480px] px-6 pb-28 lg:px-12">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 gap-8 border-t border-base-content/10 pt-12 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.25em] uppercase text-primary">Browse By Mood</p>
            <h3 className="max-w-[16ch] text-3xl font-extrabold tracking-tight lg:text-4xl text-base-content">
              Structured genres. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Cleaner discovery.</span>
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
                  className="btn btn-outline btn-block border-base-content/15 bg-base-200/50 hover:bg-primary hover:border-primary hover:text-primary-content text-xs rounded-2xl normal-case h-auto py-3.5"
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
          className="mt-16 card bg-gradient-to-br from-base-200 via-base-300 to-base-200 border border-base-content/10 shadow-2xl rounded-3xl overflow-hidden"
        >
          <div className="card-body p-8 lg:p-14">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-2 text-xs font-bold tracking-[0.25em] uppercase text-primary">Start Reading</p>
                <h4 className="max-w-[16ch] text-3xl font-extrabold tracking-tight lg:text-4xl text-base-content">
                  Build your next reading stack in minutes.
                </h4>
              </div>
              <Link href="/auth/signin" className="btn btn-primary rounded-full px-8 gap-2 font-medium shadow-xl hover:shadow-2xl">
                <span>Continue</span>
                <MotionIcon animation="float" trigger="hover">
                  <FiArrowRight />
                </MotionIcon>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
