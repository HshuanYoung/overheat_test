import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface LoadingOverlayProps {
  open?: boolean;
  title?: string;
  description?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  open = true,
  title = '加载中',
  description = '正在为你准备内容，请稍候...'
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/72 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 210, damping: 22 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-red-500/20 bg-zinc-950/95 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.55)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(220,38,38,0.18),_transparent_48%)]" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/12 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5 blur-2xl" />

            <div className="relative flex flex-col items-center text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10 shadow-[0_0_40px_rgba(220,38,38,0.18)]"
              >
                <Loader2 className="h-10 w-10 text-red-500" />
              </motion.div>

              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-red-400">
                <Sparkles className="h-3.5 w-3.5" />
                Loading
              </div>

              <h3 className="text-2xl font-black italic tracking-tighter text-white">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {description}
              </p>

              <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/6">
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '220%' }}
                  transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-red-500 to-transparent"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
