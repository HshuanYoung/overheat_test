import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Shield, Sword, Zap, Trash2, Flag, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { Card } from '../types/game';
import { CardComponent } from './Card';

interface StandardPopupProps {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  description?: string;
  mode: 'double_selection' | 'card_selection' | 'card_display' | 'payment_selection' | 'player_selection';
  
  // Double Selection props
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmType?: 'primary' | 'danger' | 'warning';
  confirmDisabled?: boolean;
  
  // Card Selection & Display props
  cards?: Card[];
  cardMeta?: Record<string, { ownerName?: string; slotLabel?: string; zoneLabel?: string; isMine?: boolean }>;
  selectedIds?: string[];
  minSelections?: number;
  maxSelections?: number;
  onCardClick?: (card: Card, e?: React.MouseEvent) => void;
  onSelectionComplete?: () => void;
  cardBackUrl?: string;
  
  // Payment props
  paymentCost?: number;
  paymentCurrent?: number;
  
  // Custom children for specialized content (like payment area)
  children?: React.ReactNode;

  // Hiding functionality
  onHide?: () => void;
  isHidden?: boolean;
}

export const StandardPopup: React.FC<StandardPopupProps> = ({
  isOpen,
  onClose,
  title,
  description,
  mode,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  confirmType = 'primary',
  confirmDisabled = false,
  cards = [],
  cardMeta = {},
  selectedIds = [],
  minSelections = 0,
  maxSelections = 0,
  onCardClick,
  onSelectionComplete,
  cardBackUrl,
  paymentCost,
  paymentCurrent,
  children,
  onHide,
  isHidden = false
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          "fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 md:p-8 transition-all duration-500 ease-in-out",
          isHidden ? "opacity-0 pointer-events-none invisible" : "opacity-100 pointer-events-auto visible"
        )}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={isHidden ? { scale: 0.8, opacity: 0, y: 40 } : { scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={cn(
            "relative w-full bg-zinc-900/90 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col transition-all duration-500 ease-in-out",
            (mode === 'double_selection' && !children) ? "max-w-md" : "max-w-6xl max-h-[90vh]",
            isHidden && "scale-95 blur-sm"
          )}
          onClick={e => e.stopPropagation()}
        >

          {/* Background Accents */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#f27d26] blur-[100px] rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-red-600 blur-[100px] rounded-full" />
          </div>

          {/* Header */}
          <div className="relative z-10 px-6 py-6 md:px-10 md:py-8 border-b border-white/5 flex flex-col items-center text-center shrink-0">
            {onHide && (
              <button 
                onClick={onHide}
                className="absolute left-6 top-6 p-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all flex items-center gap-2 group border border-white/5"
                title="隐藏窗口以查看战场"
              >
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Zap className="w-4 h-4" />
                </motion.div>
                <span className="text-[10px] font-black tracking-widest uppercase">隐藏</span>
              </button>
            )}

            {onClose && (
              <button 
                onClick={onClose}
                className="absolute right-4 top-4 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all group"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
              </button>
            )}

            <div className="flex items-center justify-center gap-3 mb-2">
              {mode === 'double_selection' && <Sparkles className="w-6 h-6 text-[#f27d26] animate-pulse" />}
              {mode === 'card_selection' && <Zap className="w-6 h-6 text-[#f27d26]" />}
              {mode === 'payment_selection' && <Loader2 className="w-6 h-6 text-[#f27d26] animate-spin" />}
              <h2 className="text-xl md:text-3xl font-black italic uppercase tracking-tighter text-white">
                {title}
              </h2>
            </div>
            
            {description && (
              <p className="text-zinc-400 text-xs md:text-sm tracking-widest uppercase max-w-2xl leading-relaxed">
                {description}
              </p>
            )}

            {/* Selection Status */}
            {mode === 'card_selection' && maxSelections > 0 && (
              <div className="mt-4 px-4 py-1.5 bg-white/5 rounded-full border border-white/10 text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest">
                选择进度: {selectedIds.length} / {maxSelections} (至少 {minSelections})
              </div>
            )}

            {/* Payment Status */}
            {mode === 'payment_selection' && paymentCost !== undefined && (
              <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-[10px] font-bold tracking-widest">需求</span>
                  <span className="text-2xl md:text-3xl font-black text-red-500">{paymentCost}</span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-[10px] font-bold tracking-widest">已选</span>
                  <span className="text-2xl md:text-3xl font-black text-white">{paymentCurrent}</span>
                </div>
              </div>
            )}
          </div>

          {/* Content Body */}
          <div className="relative z-10 flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
            {children}
            {mode === 'double_selection' ? (
              <div className="flex flex-col gap-6 items-center">
                <div className="flex gap-4 w-full">
                  <button
                    onClick={onConfirm}
                    disabled={confirmDisabled}
                    className={cn(
                      "flex-1 py-4 rounded-2xl font-black italic uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl text-sm",
                      confirmDisabled 
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50 shadow-none hover:scale-100" 
                        : confirmType === 'primary' ? "bg-[#f27d26] text-white shadow-[#f27d26]/20" :
                          confirmType === 'danger' ? "bg-red-600 text-white shadow-red-600/20" :
                          "bg-amber-500 text-black shadow-amber-500/20"
                    )}
                  >
                    {confirmText}
                  </button>
                  <button
                    onClick={onCancel || onClose}
                    className="flex-1 py-4 bg-zinc-800 text-white border border-white/10 rounded-2xl font-black italic uppercase tracking-widest transition-all hover:bg-zinc-700 hover:scale-105 active:scale-95 text-sm"
                  >
                    {cancelText}
                  </button>
                </div>
              </div>
            ) : (mode === 'card_selection' || mode === 'card_display') ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 md:gap-10 place-items-center">
                {cards.map((card, i) => {
                  const isSelected = selectedIds.includes(card.gamecardId);
                  const selectionOrder = selectedIds.indexOf(card.gamecardId) + 1;
                  const meta = cardMeta[card.gamecardId || card.id] || {};
                  const locationText = [meta.ownerName, meta.slotLabel || meta.zoneLabel].filter(Boolean).join(' · ');
                  
                  return (
                    <motion.div
                      key={`${card.gamecardId}-${i}`}
                      whileHover={{ y: -10, scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => onCardClick?.(card, e)}
                      className={cn(
                        "w-full aspect-[3/4] rounded-xl md:rounded-2xl overflow-hidden border-2 transition-all relative shrink-0",
                        isSelected 
                          ? "border-[#f27d26] shadow-[0_0_30px_rgba(242,125,38,0.4)] scale-105" 
                          : "border-white/5 opacity-80 hover:opacity-100 cursor-pointer"
                      )}
                    >
                      <CardComponent card={card} disableZoom={true} cardBackUrl={cardBackUrl} />
                      {locationText && (
                        <div className="absolute left-2 top-2 max-w-[calc(100%-1rem)] rounded-lg bg-black/80 px-2 py-1 text-[10px] font-black leading-tight text-white shadow-lg ring-1 ring-white/10">
                          {locationText}
                        </div>
                      )}
                      
                      {/* Selection Order Badge */}
                      {isSelected && mode === 'card_selection' && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-[#f27d26] text-black flex items-center justify-center shadow-2xl relative">
                            <span className="text-2xl font-black italic leading-none">{selectionOrder}</span>
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="absolute inset-0 rounded-full border-2 border-current opacity-30"
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : mode === 'payment_selection' ? (
              null // children already rendered above
            ) : mode === 'player_selection' ? (
              <div className="flex justify-center gap-12 py-8">
                {cards.map((playerCard, i) => {
                   const isSelected = selectedIds.includes(playerCard.gamecardId);
                   return (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.1, y: -10 }}
                      onClick={() => onCardClick?.(playerCard)}
                      className={cn(
                        "w-48 aspect-[3/4] bg-zinc-800 rounded-3xl flex flex-col items-center justify-center p-6 border-2 transition-all cursor-pointer",
                        isSelected ? "border-[#f27d26] shadow-[0_0_40px_rgba(242,125,38,0.3)]" : "border-white/10 hover:border-white/20"
                      )}
                    >
                      <div className="w-24 h-24 rounded-full bg-zinc-700 mb-6 flex items-center justify-center overflow-hidden border-4 border-white/5">
                        <img 
                          src={playerCard.id === 'PLAYER_SELF' ? '/assets/icons/myself.JPG' : '/assets/icons/opponent.JPG'} 
                          alt="player"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[#f27d26] font-black italic uppercase tracking-widest text-center">{playerCard.fullName}</span>
                    </motion.div>
                   )
                })}
              </div>
            ) : null}
          </div>

          {/* Footer Actions */}
          {(mode === 'card_selection' || mode === 'payment_selection') && (
            <div className="relative z-10 p-6 md:p-8 border-t border-white/5 bg-black/20 flex flex-col items-center gap-4 shrink-0">
              <button
                onClick={onSelectionComplete}
                disabled={mode === 'card_selection' && selectedIds.length < minSelections}
                className="px-12 py-4 bg-[#f27d26] text-white font-black italic uppercase tracking-[0.2em] rounded-xl hover:bg-[#f27d26]/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-[#f27d26]/20 hover:scale-105 active:scale-95"
              >
                {mode === 'card_selection' ? '确认选择' : '确认支付'}
              </button>
              <div className="flex items-center gap-2 text-zinc-600 uppercase text-[10px] font-black tracking-widest">
                <Loader2 className="w-3 h-3 animate-spin" />
                等待确认
              </div>
            </div>
          )}

          {mode === 'card_display' && (
            <div className="relative z-10 p-6 md:p-8 border-t border-white/5 bg-black/20 flex justify-center shrink-0">
              <button
                onClick={onClose}
                className="px-12 py-4 bg-zinc-800 text-white font-black italic uppercase tracking-widest rounded-xl hover:bg-zinc-700 transition-all border border-white/10"
              >
                关闭
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
