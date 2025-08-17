import React, { useState } from 'react';

// Tooltip Component with cyberpunk styling
export const WalletTooltip: React.FC<{ 
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ 
  children, 
  content,
  position = 'top'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="bg-app-quaternary cyberpunk-border color-primary text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};

// Define the application styles that will be injected
export const initStyles = () => {
  return `
  /* Background grid animation */
  @keyframes grid-pulse {
    0% { opacity: 0.1; }
    50% { opacity: 0.2; }
    100% { opacity: 0.1; }
  }

  @keyframes grid-shift {
    0% { transform: translate(0, 0); }
    25% { transform: translate(2px, 2px); }
    50% { transform: translate(0, 4px); }
    75% { transform: translate(-2px, 2px); }
    100% { transform: translate(0, 0); }
  }

  .cyberpunk-bg {
    background-color: var(--color-bg-primary);
    background-image: 
      linear-gradient(var(--color-primary-10) 1px, transparent 1px),
      linear-gradient(90deg, var(--color-primary-10) 1px, transparent 1px),
      radial-gradient(circle at 25% 25%, var(--color-primary-05) 0%, transparent 50%),
      radial-gradient(circle at 75% 75%, var(--color-primary-05) 0%, transparent 50%);
    background-size: 20px 20px, 20px 20px, 100px 100px, 150px 150px;
    background-position: center center;
    position: relative;
    overflow: hidden;
  }

  .cyberpunk-bg::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      linear-gradient(var(--color-primary-10) 1px, transparent 1px),
      linear-gradient(90deg, var(--color-primary-10) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: center center;
    animation: grid-pulse 4s infinite, grid-shift 8s infinite;
    z-index: 0;
  }

  /* Enhanced glowing border effect */
  @keyframes border-glow {
    0% { 
      box-shadow: 0 0 5px var(--color-primary-50), inset 0 0 5px var(--color-primary-20);
      border-color: var(--color-primary-50);
    }
    25% {
      box-shadow: 0 0 15px var(--color-primary-70), inset 0 0 10px var(--color-primary-30);
      border-color: var(--color-primary-70);
    }
    50% { 
      box-shadow: 0 0 20px var(--color-primary-80), inset 0 0 15px var(--color-primary-40);
      border-color: var(--color-primary-light);
    }
    75% {
      box-shadow: 0 0 15px var(--color-primary-70), inset 0 0 10px var(--color-primary-30);
      border-color: var(--color-primary-70);
    }
    100% { 
      box-shadow: 0 0 5px var(--color-primary-50), inset 0 0 5px var(--color-primary-20);
      border-color: var(--color-primary-50);
    }
  }

  .cyberpunk-border {
    border: 1px solid var(--color-primary-50);
    border-radius: 6px;
    animation: border-glow 3s infinite;
    transition: all 0.3s ease;
  }

  /* Enhanced button hover animations */
  @keyframes btn-glow {
    0% { 
      box-shadow: 0 0 5px var(--color-primary), 0 0 10px var(--color-primary-40);
      transform: scale(1);
    }
    50% { 
      box-shadow: 0 0 20px var(--color-primary), 0 0 30px var(--color-primary-60);
      transform: scale(1.02);
    }
    100% { 
      box-shadow: 0 0 5px var(--color-primary), 0 0 10px var(--color-primary-40);
      transform: scale(1);
    }
  }

  @keyframes btn-shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }

  .cyberpunk-btn {
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, var(--color-primary-dark), var(--color-primary));
  }

  .cyberpunk-btn:hover {
    animation: btn-glow 1.5s infinite;
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  }

  .cyberpunk-btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 50%,
      transparent 100%
    );
    transition: all 0.5s ease;
  }

  .cyberpunk-btn:hover::before {
    animation: btn-shimmer 0.8s ease;
  }

  .cyberpunk-btn::after {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle,
      var(--color-primary-30) 0%,
      transparent 70%
    );
    transform: scale(0);
    transition: all 0.3s ease;
    opacity: 0;
  }

  .cyberpunk-btn:hover::after {
    opacity: 1;
    transform: scale(1);
  }

  /* Glitch effect for text */
  @keyframes glitch {
    2%, 8% { transform: translate(-2px, 0) skew(0.3deg); }
    4%, 6% { transform: translate(2px, 0) skew(-0.3deg); }
    62%, 68% { transform: translate(0, 0) skew(0.33deg); }
    64%, 66% { transform: translate(0, 0) skew(-0.33deg); }
  }

  .cyberpunk-glitch {
    position: relative;
  }

  .cyberpunk-glitch:hover {
    animation: glitch 2s infinite;
  }

  /* Input focus effect */
  .cyberpunk-input:focus {
    box-shadow: 0 0 0 1px var(--color-primary-70), 0 0 15px var(--color-primary-50);
    transition: all 0.3s ease;
  }

  /* Card hover effect */
  .cyberpunk-card {
    transition: all 0.3s ease;
  }

  .cyberpunk-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 7px 20px rgba(0, 0, 0, 0.3), 0 0 15px var(--color-primary-30);
  }

  /* Scan line effect */
  @keyframes scanline {
    0% { 
      transform: translateY(-100%);
      opacity: 0.7;
    }
    100% { 
      transform: translateY(100%);
      opacity: 0;
    }
  }

  .cyberpunk-scanline {
    position: relative;
    overflow: hidden;
  }

  .cyberpunk-scanline::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 10px;
    background: linear-gradient(to bottom, 
      transparent 0%,
      var(--color-primary-20) 50%,
      transparent 100%);
    z-index: 10;
    animation: scanline 8s linear infinite;
  }

  /* Split gutter styling */
  .split-custom .gutter {
    background-color: transparent;
    position: relative;
    transition: background-color 0.3s ease;
  }

  .split-custom .gutter-horizontal {
    cursor: col-resize;
  }

  .split-custom .gutter-horizontal:hover {
    background-color: var(--color-primary-30);
  }

  .split-custom .gutter-horizontal::before,
  .split-custom .gutter-horizontal::after {
    content: "";
    position: absolute;
    width: 1px;
    height: 15px;
    background-color: var(--color-primary-70);
    left: 50%;
    transform: translateX(-50%);
    transition: all 0.3s ease;
  }

  .split-custom .gutter-horizontal::before {
    top: calc(50% - 10px);
  }

  .split-custom .gutter-horizontal::after {
    top: calc(50% + 10px);
  }

  .split-custom .gutter-horizontal:hover::before,
  .split-custom .gutter-horizontal:hover::after {
    background-color: var(--color-primary);
    box-shadow: 0 0 10px var(--color-primary-70);
  }

  /* Neo-futuristic table styling */
  .cyberpunk-table {
    border-collapse: separate;
    border-spacing: 0;
  }

  .cyberpunk-table thead th {
    background-color: var(--color-primary-10);
    border-bottom: 2px solid var(--color-primary-50);
  }

  .cyberpunk-table tbody tr {
    transition: all 0.2s ease;
  }

  .cyberpunk-table tbody tr:hover {
    background-color: var(--color-primary-05);
  }

  /* Neon text effect */
  .neon-text {
    color: var(--color-primary);
    text-shadow: 0 0 5px var(--color-primary-70);
  }

  /* Notification animation */
  @keyframes notification-slide {
    0% { transform: translateX(50px); opacity: 0; }
    10% { transform: translateX(0); opacity: 1; }
    90% { transform: translateX(0); opacity: 1; }
    100% { transform: translateX(50px); opacity: 0; }
  }

  .notification-anim {
    animation: notification-slide 4s forwards;
  }

  /* Loading animation */
  @keyframes loading-pulse {
    0% { transform: scale(0.85); opacity: 0.7; }
    50% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.85); opacity: 0.7; }
  }

  .loading-anim {
    animation: loading-pulse 1.5s infinite;
  }

  /* Button click effect */
  .cyberpunk-btn:active {
    transform: scale(0.95);
    box-shadow: 0 0 15px var(--color-primary-70);
  }

  /* Menu active state */
  .menu-item-active {
    border-left: 3px solid var(--color-primary);
    background-color: var(--color-primary-10);
  }

  /* Angle brackets for headings */
  .heading-brackets {
    position: relative;
    display: inline-block;
  }

  .heading-brackets::before,
  .heading-brackets::after {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-primary);
    font-weight: bold;
  }

  .heading-brackets::before {
    content: ">";
    left: -15px;
  }

  .heading-brackets::after {
    content: "<";
    right: -15px;
  }

  /* Fade-in animation */
  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }

  /* New enhanced animations */
  @keyframes float-gentle {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33% { transform: translateY(-8px) rotate(1deg); }
    66% { transform: translateY(-4px) rotate(-1deg); }
  }

  @keyframes pulse-border {
    0% { border-color: var(--color-primary-40); }
    50% { border-color: var(--color-primary-light); }
    100% { border-color: var(--color-primary-40); }
  }

  @keyframes glow-text {
    0%, 100% { 
      text-shadow: 0 0 5px var(--color-primary-50);
      color: var(--color-text-secondary);
    }
    50% { 
      text-shadow: 0 0 15px var(--color-primary-70), 0 0 25px var(--color-primary-50);
      color: var(--color-primary-light);
    }
  }

  @keyframes slide-in-bounce {
    0% {
      transform: translateX(-100%);
      opacity: 0;
    }
    60% {
      transform: translateX(10%);
      opacity: 0.8;
    }
    80% {
      transform: translateX(-5%);
      opacity: 0.9;
    }
    100% {
      transform: translateX(0);
      opacity: 1;
    }
  }

  /* Enhanced utility classes */
  .animate-float-gentle {
    animation: float-gentle 6s ease-in-out infinite;
  }

  .animate-pulse-border {
    animation: pulse-border 2s ease-in-out infinite;
  }

  .animate-glow-text {
    animation: glow-text 3s ease-in-out infinite;
  }

  .animate-slide-in-bounce {
    animation: slide-in-bounce 0.8s ease-out;
  }

  /* Interactive hover states */
  .hover-float:hover {
    animation: float-gentle 2s ease-in-out infinite;
  }

  .hover-glow-intense:hover {
    box-shadow: 
      0 0 20px var(--color-primary-60),
      0 0 40px var(--color-primary-40),
      0 0 60px var(--color-primary-20);
    transform: scale(1.05);
    transition: all 0.3s ease;
  }

  /* Card animations */
  .card-entrance {
    animation: slide-in-bounce 0.6s ease-out;
  }

  .card-hover-lift {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card-hover-lift:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 
      0 20px 40px var(--color-primary-20),
      0 0 20px var(--color-primary-30);
  }

  /* Background particle effect */
  .particle-bg {
    position: relative;
    overflow: hidden;
  }

  .particle-bg::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(2px 2px at 20px 30px, var(--color-primary-20), transparent),
      radial-gradient(2px 2px at 40px 70px, var(--color-primary-15), transparent),
      radial-gradient(1px 1px at 90px 40px, var(--color-primary-25), transparent),
      radial-gradient(1px 1px at 130px 80px, var(--color-primary-20), transparent),
      radial-gradient(2px 2px at 160px 30px, var(--color-primary-15), transparent);
    background-repeat: repeat;
    background-size: 200px 100px;
    animation: float-gentle 20s linear infinite;
    opacity: 0.6;
    z-index: 0;
  }
  `;
};