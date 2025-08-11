"use client";
import React, { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
// Use JS util with TS ignore to satisfy type checker in this TSX file
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { cn } from "../../../lib/utils";

type StickyBannerProps = {
  className?: string;
  children?: React.ReactNode;
  hideOnScroll?: boolean;
};

export const StickyBanner: React.FC<StickyBannerProps> = ({
  className,
  children,
  hideOnScroll = true,
}) => {
  const [open, setOpen] = useState(true);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    console.log(latest);
    if (hideOnScroll && latest > 40) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  });

  return (
    <motion.div
      className={cn(
        "sticky inset-x-0 top-0 z-40 flex min-h-9 w-full items-center justify-center bg-transparent px-3 py-0.5",
        className
      )}
      initial={{
        y: -100,
        opacity: 0,
      }}
      animate={{
        y: open ? 0 : -100,
        opacity: open ? 1 : 0,
      }}
      transition={{
        duration: 0.3,
        ease: "easeInOut",
      }}>
      {children}
      <motion.button
        initial={{
          scale: 0,
        }}
        animate={{
          scale: 1,
        }}
        className="absolute right-3 inset-y-0 my-auto grid h-5 w-5 place-items-center rounded hover:bg-white/10 cursor-pointer"
        onClick={() => setOpen(!open)}>
        <CloseIcon className="h-4 w-4 text-white" />
      </motion.button>
    </motion.div>
  );
};

const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  );
};
