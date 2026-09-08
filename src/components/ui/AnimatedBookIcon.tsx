"use client";

import { useImperativeHandle } from "react";
import { motion, useAnimation, type Variants } from "framer-motion";

const EASE = [0.4, 0, 0.2, 1] as const;

export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type IconShellProps = {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  ref?: React.Ref<AnimatedIconHandle>;
  children: (controls: ReturnType<typeof useAnimation>) => React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "ref" | "style">;

function IconShell({ children, className, size = 24, style, ref, ...props }: IconShellProps) {
  const controls = useAnimation();

  useImperativeHandle(
    ref,
    () => ({
      startAnimation: () => controls.start("animate"),
      stopAnimation: () => controls.start("normal"),
    }),
    [controls]
  );

  return (
    <div
      className={className}
      style={style}
      onMouseEnter={() => controls.start("animate")}
      onMouseLeave={() => controls.start("normal")}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ overflow: "visible" }}
      >
        {children(controls)}
      </svg>
    </div>
  );
}

export type AnimatedBookIconProps = {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  ref?: React.Ref<AnimatedIconHandle>;
};

export function BookIcon({ className, size, style, ref, ...props }: AnimatedBookIconProps) {
  const pages: Variants = {
    normal: { rotate: 0, transition: { duration: 0.3, ease: EASE } },
    animate: {
      rotate: [0, -10, 6, 0],
      transition: { duration: 0.7, ease: "easeInOut" },
    },
  };
  return (
    <IconShell className={className} size={size} style={style} ref={ref} {...props}>
      {(controls) => (
        <>
          <motion.path
            d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
            animate={controls}
            variants={{
              normal: { scale: 1, transition: { duration: 0.3, ease: EASE } },
              animate: { scale: [1, 1.08, 1], transition: { duration: 0.6, ease: EASE } },
            }}
            style={{ originX: "50%", originY: "50%" }}
          />
          <motion.path
            d="M8 7h8"
            animate={controls}
            variants={{
              normal: { scaleX: 1, opacity: 1, transition: { duration: 0.3, ease: EASE } },
              animate: {
                scaleX: [1, 0.6, 1],
                opacity: [1, 0.5, 1],
                transition: { duration: 0.7, ease: "easeInOut" },
              },
            }}
            style={{ originX: "50%", originY: "50%" }}
          />
          <motion.path
            d="M8 11h6"
            animate={controls}
            variants={pages}
            style={{ originX: "0%", originY: "50%" }}
          />
        </>
      )}
    </IconShell>
  );
}
