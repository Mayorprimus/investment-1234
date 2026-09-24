import React from 'react';
import { X, Trophy, MessageCircle, Youtube, Instagram, MessagesSquare, Music, Linkedin, Check, ArrowRight, Sparkles } from 'lucide-react';

interface TasksWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExploreTasks: () => void;
}

const platforms = [
  { name: 'Twitter (X)', icon: 'twitter' },
  { name: 'Telegram', icon: 'telegram' },
  { name: 'YouTube', icon: 'youtube' },
  { name: 'Instagram', icon: 'instagram' },
  { name: 'Discord', icon: 'discord' },
  { name: 'TikTok', icon: 'tiktok' },
  { name: 'LinkedIn', icon: 'custom' },
];

const PlatformIcon = ({ name }: { name: string }) => {
  switch (name) {
    case 'twitter': return <Sparkles className="w-4 h-4" />;
    case 'telegram': return <MessageCircle className="w-4 h-4" />;
    case 'youtube': return <Youtube className="w-4 h-4" />;
    case 'instagram': return <Instagram className="w-4 h-4" />;
    case 'discord': return <MessagesSquare className="w-4 h-4" />;
    case 'tiktok': return <Music className="w-4 h-4" />;
    case 'custom': return <Linkedin className="w-4 h-4" />;
    default: return <Trophy className="w-4 h-4" />;
  }
};

export const TasksWelcomeModal: React.FC<TasksWelcomeModalProps> = ({ isOpen, onClose, onExploreTasks }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" id="tasks-welcome-modal">
      <div className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[24px] shadow-2xl border border-[#EDE9FE] overflow-hidden animate-scale-up">
        <div className="h-1.5 bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#DB2777]" />
        <button
          onClick={onClose}
          className="absolute right-3.5 top-5 w-8 h-8 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] font-bold flex items-center justify-center cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#A855F7] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(109,40,217,0.35)]">
              <Trophy className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-extrabold text-[#171717] mt-3">Do Tasks & Earn XENA 🎉</h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              Complete simple social actions. Admin verifies. You get rewarded.
            </p>
          </div>

          <div className="space-y-2.5 mt-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/80 border border-purple-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center">
                <Trophy className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">30 XENA per task</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Admin sets reward. Current tasks pay 30 XENA each.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/80 border border-purple-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">7 platforms available</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Twitter, Telegram, YouTube, Instagram, Discord, TikTok, LinkedIn</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                <Check className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">1 submission per task</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Submit your handle/URL once. Admin verifies & credits XENA.</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2 p-3 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE]">
              {platforms.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                  <span className="w-6 h-6 rounded-lg bg-purple-50 text-[#6D28D9] flex items-center justify-center">
                    <PlatformIcon name={p.icon} />
                  </span>
                  <span className="font-semibold text-[#171717]">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onExploreTasks();
            }}
            className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" /> Explore Tasks
          </button>
          <button
            onClick={onClose}
            className="w-full mt-2 py-2.5 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE] text-[#6B7280] font-bold text-xs hover:bg-[#EDE9FE] transition-colors cursor-pointer"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};