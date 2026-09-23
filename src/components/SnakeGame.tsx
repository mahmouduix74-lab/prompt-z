import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { AppLang } from '../utils/i18n';
import {
  RotateCcw,
  Trophy,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Gamepad2,
} from 'lucide-react';

interface SnakeGameProps {
  lang: AppLang;
  isAr: boolean;
  theme?: 'light' | 'dark';
}

const GRID_SIZE = 16;
const CELL_SIZE = 14; // Canvas resolution per cell
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE; // 224px

type Position = { x: number; y: number };

export const SnakeGame: React.FC<SnakeGameProps> = ({ lang, isAr, theme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Dynamic theme detection
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (theme) return theme === 'dark';
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    if (theme) {
      setIsDark(theme === 'dark');
      return;
    }
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [theme]);

  const [snake, setSnake] = useState<Position[]>([
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 },
  ]);
  const [direction, setDirection] = useState<Position>({ x: 1, y: 0 });
  const dirRef = useRef<Position>({ x: 1, y: 0 }); // Prevents rapid double-key turns in 1 tick

  const [food, setFood] = useState<Position>({ x: 12, y: 8 });
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('snake_high_score') || '0', 10);
    } catch {
      return 0;
    }
  });
  const [gameOver, setGameOver] = useState<boolean>(false);

  // Generate random food not on snake body
  const spawnFood = useCallback((currentSnake: Position[]): Position => {
    let newFood: Position;
    let isOnSnake: boolean;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // eslint-disable-next-line no-loop-func
      isOnSnake = currentSnake.some((seg) => seg.x === newFood.x && seg.y === newFood.y);
    } while (isOnSnake);
    return newFood;
  }, []);

  const handleReset = useCallback(() => {
    const initialSnake = [
      { x: 8, y: 8 },
      { x: 7, y: 8 },
      { x: 6, y: 8 },
    ];
    setSnake(initialSnake);
    setDirection({ x: 1, y: 0 });
    dirRef.current = { x: 1, y: 0 };
    setFood(spawnFood(initialSnake));
    setScore(0);
    setGameOver(false);
  }, [spawnFood]);

  // Handle keyboard inputs
  const changeDirection = useCallback((newDir: Position) => {
    const current = dirRef.current;
    // Prevent 180 degree reverse turns
    if (current.x + newDir.x === 0 && current.y + newDir.y === 0) return;
    dirRef.current = newDir;
    setDirection(newDir);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keys if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isGameTarget = containerRef.current && (containerRef.current.contains(target) || document.activeElement === containerRef.current);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd', 'W', 'S', 'A', 'D'].includes(e.key)) {
        if (isGameTarget) {
          e.preventDefault();
        }
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          changeDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          changeDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          changeDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          changeDirection({ x: 1, y: 0 });
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection]);

  // Main game tick interval (slower speed: 210ms tick rate)
  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      setSnake((prevSnake) => {
        const head = prevSnake[0];
        const dir = dirRef.current;
        // Wrap around walls for smooth casual play
        const newHead = {
          x: (head.x + dir.x + GRID_SIZE) % GRID_SIZE,
          y: (head.y + dir.y + GRID_SIZE) % GRID_SIZE,
        };

        // Check self-collision
        const isSelfCollision = prevSnake.some(
          (segment, index) => index !== 0 && segment.x === newHead.x && segment.y === newHead.y
        );

        if (isSelfCollision) {
          setGameOver(true);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // Check if food eaten
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore((s) => {
            const newScore = s + 1;
            setHighScore((prevHigh) => {
              if (newScore > prevHigh) {
                try {
                  localStorage.setItem('snake_high_score', newScore.toString());
                } catch {
                  // ignore
                }
                return newScore;
              }
              return prevHigh;
            });
            return newScore;
          });
          setFood(spawnFood(newSnake));
        } else {
          newSnake.pop(); // Remove tail
        }

        return newSnake;
      });
    }, 145);

    return () => clearInterval(interval);
  }, [food, gameOver, spawnFood]);

  // Touch Swipe Gesture Handlers for Canvas Container
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    const minSwipeDistance = 18; // 18px swipe threshold

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) >= minSwipeDistance) {
        if (deltaX > 0) {
          changeDirection({ x: 1, y: 0 }); // Right
        } else {
          changeDirection({ x: -1, y: 0 }); // Left
        }
      }
    } else {
      if (Math.abs(deltaY) >= minSwipeDistance) {
        if (deltaY > 0) {
          changeDirection({ x: 0, y: 1 }); // Down
        } else {
          changeDirection({ x: 0, y: -1 }); // Up
        }
      }
    }
    touchStartRef.current = null;
  };

  // Draw game to canvas (Adapts dynamically to Light/Dark Mode)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background color based on active theme
    const bgFill = isDark ? '#09090B' : '#FAF8FF';
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid lines color
    ctx.strokeStyle = isDark ? 'rgba(161, 161, 170, 0.08)' : 'rgba(147, 51, 234, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw glowing Food (Prompt Sparkle with outer aura)
    const foodX = food.x * CELL_SIZE + CELL_SIZE / 2;
    const foodY = food.y * CELL_SIZE + CELL_SIZE / 2;

    ctx.save();
    // Outer food aura ring
    ctx.fillStyle = isDark ? 'rgba(168, 85, 247, 0.22)' : 'rgba(124, 58, 237, 0.18)';
    ctx.beginPath();
    ctx.arc(foodX, foodY, CELL_SIZE / 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Inner glowing food orb
    ctx.shadowColor = isDark ? '#C084FC' : '#7C3AED';
    ctx.shadowBlur = isDark ? 10 : 8;
    ctx.fillStyle = isDark ? '#C084FC' : '#7C3AED';
    ctx.beginPath();
    ctx.arc(foodX, foodY, CELL_SIZE / 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw Snake with direction-aware eyes & smooth gradient body
    const dir = dirRef.current;
    snake.forEach((segment, index) => {
      const isHead = index === 0;
      const x = segment.x * CELL_SIZE;
      const y = segment.y * CELL_SIZE;

      ctx.save();
      if (isHead) {
        ctx.shadowColor = isDark ? '#A855F7' : '#6D28D9';
        ctx.shadowBlur = 8;
        ctx.fillStyle = isDark ? '#A855F7' : '#6D28D9';
      } else {
        const opacity = Math.max(0.35, 1 - index / (snake.length + 3));
        ctx.fillStyle = isDark
          ? `rgba(168, 85, 247, ${opacity})`
          : `rgba(124, 58, 237, ${opacity})`;
      }

      const radius = isHead ? 5 : 3;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, radius);
      ctx.fill();

      // Render eyes on head segment facing current direction
      if (isHead) {
        ctx.fillStyle = '#FFFFFF';
        const eyeRadius = 1.3;
        let eye1X = x + CELL_SIZE / 2;
        let eye1Y = y + CELL_SIZE / 2;
        let eye2X = x + CELL_SIZE / 2;
        let eye2Y = y + CELL_SIZE / 2;

        if (dir.x === 1) {
          // Moving Right
          eye1X = x + CELL_SIZE - 3.5; eye1Y = y + 4;
          eye2X = x + CELL_SIZE - 3.5; eye2Y = y + CELL_SIZE - 4;
        } else if (dir.x === -1) {
          // Moving Left
          eye1X = x + 3.5; eye1Y = y + 4;
          eye2X = x + 3.5; eye2Y = y + CELL_SIZE - 4;
        } else if (dir.y === -1) {
          // Moving Up
          eye1X = x + 4; eye1Y = y + 3.5;
          eye2X = x + CELL_SIZE - 4; eye2Y = y + 3.5;
        } else {
          // Moving Down
          eye1X = x + 4; eye1Y = y + CELL_SIZE - 3.5;
          eye2X = x + CELL_SIZE - 4; eye2Y = y + CELL_SIZE - 3.5;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }, [snake, food, isDark]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="flex flex-col items-center justify-center select-none w-full max-w-xs mx-auto text-center focus:outline-none"
    >
      {/* Game Title & Header Status - Clean Title without "Touch/Arrow" phrase */}
      <div
        className={`flex items-center gap-1.5 mb-2 px-3 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
          isDark
            ? 'bg-purple-950/50 border-purple-800/50 text-purple-300'
            : 'bg-purple-100/90 border-purple-200 text-purple-800'
        }`}
      >
        <Gamepad2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
        <span>{isAr ? '🎮 لعبة الثعبان' : '🎮 Snake Game'}</span>
      </div>

      {/* Score bar */}
      <div
        className={`flex items-center justify-between w-full px-3 py-1.5 mb-2 rounded-xl border text-[11px] font-mono transition-colors ${
          isDark
            ? 'bg-zinc-900/90 border-zinc-800/80 text-zinc-300'
            : 'bg-white/90 border-purple-200/80 text-zinc-800 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400">
          <Sparkles className="w-3 h-3" />
          <span>{isAr ? 'النقاط:' : 'Score:'} {score}</span>
        </div>
        <div className="flex items-center gap-1 font-semibold text-zinc-500 dark:text-zinc-400">
          <Trophy className="w-3 h-3 text-amber-500" />
          <span>{isAr ? 'الأعلى:' : 'Best:'} {highScore}</span>
        </div>
      </div>

      {/* Canvas Container with Theme Adaptation & Touch Gestures */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`relative rounded-xl overflow-hidden border-2 transition-colors touch-none ${
          isDark
            ? 'border-purple-500/30 bg-zinc-950 shadow-md'
            : 'border-purple-300 bg-purple-50/70 shadow-sm'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="block cursor-pointer touch-none"
        />

        {/* Game Over overlay inside canvas */}
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute inset-0 backdrop-blur-xs flex flex-col items-center justify-center p-3 transition-colors ${
              isDark ? 'bg-zinc-950/92 text-white' : 'bg-white/95 text-zinc-900'
            }`}
          >
            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">
              {isAr ? 'اصطدمت بنفسك!' : 'Game Over!'}
            </p>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-mono mb-2.5">
              {isAr ? `النقاط: ${score}` : `Score: ${score}`}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? 'إعادة اللعب' : 'Play Again'}</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* Touch / D-Pad On-screen Controls for Mobile */}
      <div className="mt-3 flex flex-col items-center gap-1.5 select-none touch-none">
        {/* UP Button */}
        <button
          type="button"
          onClick={() => changeDirection({ x: 0, y: -1 })}
          className={`w-13 h-12 sm:w-14 sm:h-12 flex items-center justify-center rounded-2xl border font-bold shadow-xs active:scale-90 transition-all cursor-pointer touch-none ${
            isDark
              ? 'bg-zinc-900/90 border-zinc-700/80 text-purple-300 hover:bg-purple-600 hover:text-white active:bg-purple-600 active:text-white shadow-xs'
              : 'bg-white border-purple-200/90 text-purple-700 hover:bg-purple-600 hover:text-white active:bg-purple-600 active:text-white shadow-xs'
          }`}
          aria-label={isAr ? 'أعلى' : 'Up'}
        >
          <ArrowUp className="w-5 h-5 shrink-0" />
        </button>

        <div className="flex items-center gap-2">
          {/* LEFT Button */}
          <button
            type="button"
            onClick={() => changeDirection({ x: -1, y: 0 })}
            className={`w-13 h-12 sm:w-14 sm:h-12 flex items-center justify-center rounded-2xl border font-bold shadow-xs active:scale-90 transition-all cursor-pointer touch-none ${
              isDark
                ? 'bg-zinc-900/90 border-zinc-700/80 text-purple-300 hover:bg-purple-600 hover:text-white active:bg-purple-600 active:text-white shadow-xs'
                : 'bg-white border-purple-200/90 text-purple-700 hover:bg-purple-600 hover:text-white active:bg-purple-600 active:text-white shadow-xs'
            }`}
            aria-label={isAr ? 'يسار' : 'Left'}
          >
            <ArrowLeft className="w-5 h-5 shrink-0" />
          </button>

          {/* Center Arcade Core Decorative Badge */}
          <div
            className={`w-10 h-12 sm:w-11 sm:h-12 flex items-center justify-center rounded-xl border opacity-75 ${
              isDark
                ? 'bg-zinc-950/80 border-zinc-800 text-purple-400'
                : 'bg-purple-50/80 border-purple-200/60 text-purple-500'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500/50 animate-pulse" />
          </div>

          {/* RIGHT Button */}
          <button
            type="button"
            onClick={() => changeDirection({ x: 1, y: 0 })}
            className={`w-13 h-12 sm:w-14 sm:h-12 flex items-center justify-center rounded-2xl border font-bold shadow-xs active:scale-90 transition-all cursor-pointer touch-none ${
              isDark
                ? 'bg-zinc-900/90 border-zinc-700/80 text-purple-300 hover:bg-purple-600 hover:text-white active:bg-purple-600 active:text-white shadow-xs'
                : 'bg-white border-purple-200/90 text-purple-700 hover:bg-purple-600 hover:text-white active:bg-purple-600 active:text-white shadow-xs'
            }`}
            aria-label={isAr ? 'يمين' : 'Right'}
          >
            <ArrowRight className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* DOWN Button */}
        <button
          type="button"
          onClick={() => changeDirection({ x: 0, y: 1 })}
          className={`w-13 h-12 sm:w-14 sm:h-12 flex items-center justify-center rounded-2xl border font-bold shadow-xs active:scale-90 transition-all cursor-pointer touch-none ${
            isDark
              ? 'bg-zinc-900/90 border-zinc-700/80 text-purple-300 hover:bg-purple-600 hover:text-white active:bg-purple-600 active:text-white shadow-xs'
              : 'bg-white border-purple-200/90 text-purple-700 hover:bg-purple-600 hover:text-white active:bg-purple-600 active:text-white shadow-xs'
          }`}
          aria-label={isAr ? 'أسفل' : 'Down'}
        >
          <ArrowDown className="w-5 h-5 shrink-0" />
        </button>
      </div>

      {/* AI Generating Indicator Footer Status */}
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600 dark:text-purple-400 shrink-0" />
        <span>
          {isAr
            ? 'جاري صياغة وهيكلة البرومبت...'
            : 'AI is crafting your prompt...'}
        </span>
      </div>
    </div>
  );
};
