"use client";

import { useEffect, useRef, useState } from "react";

interface ConfettiProps {
  active: boolean;
  duration?: number;
}

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
  borderRadius: string;
  animDuration: number;
}

const COLORS = ["#f97316", "#fb923c", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6"];

function generateParticles(): Particle[] {
  return Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 500,
    size: 4 + Math.random() * 6,
    borderRadius: Math.random() > 0.5 ? "50%" : "2px",
    animDuration: 1500 + Math.random() * 1500,
  }));
}

export function Confetti({ active, duration = 3000 }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const prevActive = useRef(false);

  useEffect(() => {
    if (active && !prevActive.current) {
      const newParticles = generateParticles();
      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
      }, duration);

      prevActive.current = true;
      return () => clearTimeout(timer);
    }

    if (!active && prevActive.current) {
      prevActive.current = false;
    }
  }, [active, duration]);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.borderRadius,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.animDuration}ms`,
          }}
        />
      ))}
    </div>
  );
}
