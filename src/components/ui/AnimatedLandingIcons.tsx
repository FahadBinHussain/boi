"use client";

import { useImperativeHandle } from "react";
import { motion, useAnimation } from "framer-motion";

const EASE = [0.4, 0, 0.2, 1] as const;

export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type IconShellProps = {
  className?: string;
  size?: number;
  ref?: React.Ref<AnimatedIconHandle>;
  children: (c: ReturnType<typeof useAnimation>) => React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "ref">;

function IconShell({ children, className, size = 20, ref, ...props }: IconShellProps) {
  const controls = useAnimation();
  useImperativeHandle(ref, () => ({
    startAnimation: () => controls.start("animate"),
    stopAnimation: () => controls.start("normal"),
  }), [controls]);
  return (
    <div
      className={className}
      onMouseEnter={() => controls.start("animate")}
      onMouseLeave={() => controls.start("normal")}
      {...props}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: "visible" }}>
        {children(controls)}
      </svg>
    </div>
  );
}

export type AnimatedLandingIconProps = { className?: string; size?: number; ref?: React.Ref<AnimatedIconHandle> };

export function BookOpenIcon({ className, size, ref, ...props }: AnimatedLandingIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.path d="M12 7v14"
            animate={controls}
            variants={{ normal: { opacity: 1, transition: { duration: 0.3, ease: EASE } }, animate: { opacity: [1, 0.4, 1], transition: { duration: 0.7, ease: "easeInOut" } } }}
          />
          <motion.path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
            animate={controls}
            variants={{ normal: { scale: 1, transition: { duration: 0.3, ease: EASE } }, animate: { scale: [1, 1.1, 1], transition: { duration: 0.6, ease: EASE } } }}
            style={{ originX: "50%", originY: "50%" }}
          />
        </>
      )}
    </IconShell>
  );
}

export function TrendingUpIcon({ className, size, ref, ...props }: AnimatedLandingIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.polyline points="22 7 13.5 15.5 8.5 10.5 2 17"
            animate={controls}
            variants={{ normal: { pathLength: 1, transition: { duration: 0.3, ease: EASE } }, animate: { pathLength: [0, 1], transition: { duration: 0.7, ease: EASE } } }}
          />
          <motion.polyline points="16 7 22 7 22 13"
            animate={controls}
            variants={{ normal: { scale: 1, opacity: 1, transition: { duration: 0.3, ease: EASE } }, animate: { scale: [0.7, 1.1, 1], opacity: [0, 1], transition: { duration: 0.6, delay: 0.35, ease: EASE } } }}
            style={{ originX: "100%", originY: "0%" }}
          />
        </>
      )}
    </IconShell>
  );
}

export function ClockIcon({ className, size, ref, ...props }: AnimatedLandingIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.circle cx="12" cy="12" r="10"
            animate={controls}
            variants={{ normal: { scale: 1, transition: { duration: 0.3, ease: EASE } }, animate: { scale: [1, 1.08, 1], transition: { duration: 0.5, ease: EASE } } }}
            style={{ originX: "50%", originY: "50%" }}
          />
          <motion.polyline points="12 6 12 12 16 14"
            animate={controls}
            variants={{ normal: { rotate: 0, transition: { duration: 0.3, ease: EASE } }, animate: { rotate: 300, transition: { duration: 0.6, ease: EASE } } }}
            style={{ originX: "50%", originY: "50%" }}
          />
        </>
      )}
    </IconShell>
  );
}

export function GridIcon({ className, size, ref, ...props }: AnimatedLandingIconProps) {
  return (
    <IconShell className={className} size={size} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.rect x="3" y="3" width="7" height="7" rx="1"
            animate={controls}
            variants={{ normal: { x: 0, y: 0, transition: { duration: 0.3, ease: EASE } }, animate: { x: [0, -1.5, 0], y: [0, -1.5, 0], transition: { duration: 0.6, ease: "easeInOut" } } }}
          />
          <motion.rect x="14" y="3" width="7" height="7" rx="1"
            animate={controls}
            variants={{ normal: { x: 0, y: 0, transition: { duration: 0.3, ease: EASE } }, animate: { x: [0, 1.5, 0], y: [0, -1.5, 0], transition: { duration: 0.6, delay: 0.08, ease: "easeInOut" } } }}
          />
          <motion.rect x="14" y="14" width="7" height="7" rx="1"
            animate={controls}
            variants={{ normal: { x: 0, y: 0, transition: { duration: 0.3, ease: EASE } }, animate: { x: [0, 1.5, 0], y: [0, 1.5, 0], transition: { duration: 0.6, delay: 0.14, ease: "easeInOut" } } }}
          />
          <motion.rect x="3" y="14" width="7" height="7" rx="1"
            animate={controls}
            variants={{ normal: { x: 0, y: 0, transition: { duration: 0.3, ease: EASE } }, animate: { x: [0, -1.5, 0], y: [0, 1.5, 0], transition: { duration: 0.6, delay: 0.2, ease: "easeInOut" } } }}
          />
        </>
      )}
    </IconShell>
  );
}
