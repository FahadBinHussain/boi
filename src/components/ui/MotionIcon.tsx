"use client";

import React, { useState } from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

export type MotionIconAnimationType =
  | "bounce"
  | "spin"
  | "pulse"
  | "wiggle"
  | "float"
  | "hover";

export interface MotionIconProps extends Omit<HTMLMotionProps<"span">, "children"> {
  children: React.ReactNode;
  animation?: MotionIconAnimationType;
  trigger?: "hover" | "always" | "pulse";
  className?: string;
  size?: number | string;
}

const variantsMap: Record<MotionIconAnimationType, Variants> = {
  bounce: {
    rest: { y: 0, scale: 1 },
    hover: {
      y: [0, -4, 0, -2, 0],
      scale: [1, 1.15, 1],
      transition: { duration: 0.6, ease: "easeInOut" },
    },
    always: {
      y: [0, -3, 0],
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
    },
  },
  spin: {
    rest: { rotate: 0 },
    hover: {
      rotate: 360,
      transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] },
    },
    always: {
      rotate: 360,
      transition: { duration: 2, repeat: Infinity, ease: "linear" },
    },
  },
  pulse: {
    rest: { scale: 1, opacity: 1 },
    hover: {
      scale: [1, 1.25, 0.95, 1],
      transition: { duration: 0.5, ease: "easeInOut" },
    },
    always: {
      scale: [1, 1.12, 1],
      opacity: [1, 0.85, 1],
      transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
    },
  },
  wiggle: {
    rest: { rotate: 0 },
    hover: {
      rotate: [0, -14, 14, -8, 8, 0],
      transition: { duration: 0.6, ease: "easeInOut" },
    },
    always: {
      rotate: [0, -6, 6, 0],
      transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
    },
  },
  float: {
    rest: { y: 0 },
    hover: {
      y: -3,
      scale: 1.1,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    always: {
      y: [0, -4, 0],
      transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
    },
  },
  hover: {
    rest: { scale: 1, rotate: 0 },
    hover: {
      scale: 1.15,
      transition: { duration: 0.25, ease: "easeOut" },
    },
    always: {
      scale: [1, 1.05, 1],
      transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
    },
  },
};

export default function MotionIcon({
  children,
  animation = "hover",
  trigger = "hover",
  className = "",
  style,
  ...props
}: MotionIconProps) {
  const [isHovered, setIsHovered] = useState(false);
  const activeVariants = variantsMap[animation] || variantsMap.hover;

  const animateState =
    trigger === "always"
      ? "always"
      : isHovered
      ? "hover"
      : "rest";

  return (
    <motion.span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ display: "inline-flex", verticalAlign: "middle", ...style }}
      variants={activeVariants}
      animate={animateState}
      initial="rest"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {children}
    </motion.span>
  );
}
