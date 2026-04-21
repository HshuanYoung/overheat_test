import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Book, Shield, Sword, Zap, AlertTriangle } from 'lucide-react';

interface RulebookProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Rulebook: React.FC<RulebookProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl bg-[#1a1a1a] border border-[#f27d26]/30 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-8 py-4 md:py-6 bg-[#1a1a1a] border-b border-[#f27d26]/20">
              <div className="flex items-center gap-2 md:gap-3">
                <Book className="w-5 h-5 md:w-6 md:h-6 text-[#f27d26]" />
                <h2 className="text-lg md:text-2xl font-bold tracking-tighter text-white uppercase italic">
                  简易规则书
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 md:p-8 space-y-8 md:space-y-12 text-gray-300 font-sans leading-relaxed overflow-y-auto max-h-[85vh]">
              
              {/* Section 1: Deck & Winning */}
              <section className="space-y-4">
                <h3 className="text-lg md:text-xl font-bold text-[#f27d26] border-l-4 border-[#f27d26] pl-4 uppercase">
                  一、核心规则
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <div className="p-4 md:p-6 bg-white/5 rounded-xl border border-white/10">
                    <h4 className="flex items-center gap-2 text-white font-bold mb-3">
                      <Shield className="w-4 h-4 text-blue-400" /> 卡组构筑
                    </h4>
                    <ul className="text-xs md:text-sm space-y-2 list-disc pl-5">
                      <li>卡组包含 50 张卡，不能少于 50 张。</li>
                      <li>同名卡最多放入 4 张。</li>
                      <li>具有 <span className="text-[#f27d26]">“神蚀标记（♾）”</span> 的卡，卡组内限 10 张。</li>
                    </ul>
                  </div>
                  <div className="p-4 md:p-6 bg-white/5 rounded-xl border border-white/10">
                    <h4 className="flex items-center gap-2 text-white font-bold mb-3">
                      <Sword className="w-4 h-4 text-red-400" /> 胜利条件
                    </h4>
                    <ul className="text-xs md:text-sm space-y-2 list-disc pl-5">
                      <li>对手受到伤害时，卡组剩余卡不足以承受。</li>
                      <li>对手抽卡时，卡组剩余卡不足以抽卡。</li>
                      <li>对手侵蚀区中的 <span className="text-red-500 font-bold">背面卡</span> 达到 10 张。</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 2: Casting */}
              <section className="space-y-4">
                <h3 className="text-lg md:text-xl font-bold text-[#f27d26] border-l-4 border-[#f27d26] pl-4 uppercase">
                  二、使用卡牌
                </h3>
                <div className="space-y-4">
                  <p className="text-xs md:text-sm">使用卡牌需满足两个条件：</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <h4 className="text-white font-semibold text-sm">1. 颜色需求</h4>
                      <p className="text-xs md:text-sm opacity-80">统计战场单位及侵蚀区正面卡的颜色，需满足卡牌左上角标记。</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-white font-semibold text-sm">2. 支付ACESS值</h4>
                      <p className="text-xs md:text-sm opacity-80">
                        <span className="text-green-400">正值：</span> 从卡组顶将卡正面朝上放置到侵蚀区。横置单位可减少支付。<br/>
                        <span className="text-red-400">负值：</span> 从侵蚀区将对应数量正面卡送入墓地。
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Goddess Mode */}
              <section className="p-4 md:p-8 bg-gradient-to-br from-[#f27d26]/20 to-transparent rounded-2xl border border-[#f27d26]/30">
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <AlertTriangle className="w-8 h-8 text-[#f27d26] shrink-0" />
                  <div className="space-y-2">
                    <h3 className="text-lg md:text-xl font-black text-white uppercase italic tracking-widest leading-tight">
                      女神化状态
                    </h3>
                    <p className="text-xs md:text-sm">
                      若玩家侵蚀区的卡达到 <span className="text-[#f27d26] font-bold">10 张以上</span>，即进入女神化状态。
                    </p>
                    <ul className="text-xs md:text-sm space-y-1 list-disc pl-5 opacity-90">
                      <li>再次受到伤害时，伤害处理 <span className="text-red-500 font-bold">翻倍</span>。</li>
                      <li>触发卡牌上的 <span className="text-yellow-400 font-bold">OH刻度</span> 特别能力。</li>
                      <li>这是通往胜利的捷径，也是败北的深渊。</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 4: Phases */}
              <section className="space-y-6">
                <h3 className="text-lg md:text-xl font-bold text-[#f27d26] border-l-4 border-[#f27d26] pl-4 uppercase">
                  三、回合流程
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  {[
                    { title: 'Ⅰ 开始阶段', desc: '重置所有单位和道具。' },
                    { title: 'Ⅱ 抽卡阶段', desc: '抽1张卡（先攻首回合除外）。' },
                    { title: 'Ⅲ 侵蚀阶段', desc: '处理侵蚀区正面卡（送墓/保留/回手）。' },
                    { title: 'Ⅳ 主要阶段', desc: '使用卡牌、发动能力、进入战斗。' },
                    { title: 'Ⅴ 战斗阶段', desc: '攻击宣言、防御宣言、伤害判定。' },
                    { title: 'Ⅵ 结束阶段', desc: '手牌上限检查（6张）。' },
                  ].map((phase, i) => (
                    <div key={i} className="p-3 md:p-4 bg-white/5 rounded-lg border border-white/5 hover:border-[#f27d26]/30 transition-all">
                      <div className="text-[#f27d26] font-bold text-[10px] md:text-xs mb-1 uppercase tracking-tighter">{phase.title}</div>
                      <div className="text-[10px] md:text-xs opacity-70 leading-tight">{phase.desc}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Footer */}
              <div className="pt-8 border-t border-white/10 text-center opacity-40 text-[10px] uppercase tracking-widest">
                神蚀创痕对战界面 V1.1
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
