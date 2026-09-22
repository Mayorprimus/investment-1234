import React, { useState, useEffect } from 'react';
import { Twitter, MessageCircle, Youtube, Instagram, Discord, Music, Linkedin, Check, Loader2, AlertCircle, X, ExternalLink, Clock, Trophy, UserCheck } from 'lucide-react';
import { SocialTask, TaskSubmission } from '../lib/api';
import { getSocialTasks, getMyTaskSubmissions, submitTask } from '../lib/api';
import { UserBalances } from '../types';

interface TasksPageProps {
  user: { name: string; xenaId: string };
  balances: UserBalances;
  xenaUsdPrice: number;
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  twitter: Twitter,
  telegram: MessageCircle,
  youtube: Youtube,
  instagram: Instagram,
  discord: Discord,
  tiktok: Music,
  custom: Linkedin,
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-sky-500',
  telegram: 'bg-blue-500',
  youtube: 'bg-red-500',
  instagram: 'bg-pink-500',
  discord: 'bg-indigo-500',
  tiktok: 'bg-black',
  custom: 'bg-blue-700',
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter (X)',
  telegram: 'Telegram',
  youtube: 'YouTube',
  instagram: 'Instagram',
  discord: 'Discord',
  tiktok: 'TikTok',
  custom: 'LinkedIn',
};

export const TasksPage: React.FC<TasksPageProps> = ({ user, balances, xenaUsdPrice }) => {
  const [tasks, setTasks] = useState<SocialTask[]>([]);
  const [mySubmissions, setMySubmissions] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [modalTask, setModalTask] = useState<SocialTask | null>(null);
  const [socialHandle, setSocialHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, subsRes] = await Promise.all([
        getSocialTasks(),
        getMyTaskSubmissions(),
      ]);
      if (tasksRes.ok && tasksRes.tasks) setTasks(tasksRes.tasks);
      if (subsRes.ok && subsRes.submissions) setMySubmissions(subsRes.submissions);
    } catch (e) {
      console.error('Failed to load tasks:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getSubmissionStatus = (taskId: string): 'pending' | 'approved' | 'rejected' | null => {
    const sub = mySubmissions.find(s => s.taskId === taskId);
    return sub?.status ?? null;
  };

  const openModal = (task: SocialTask) => {
    const status = getSubmissionStatus(task.id);
    if (status === 'approved') return;
    if (status === 'pending') {
      setError('You have already submitted this task. Waiting for admin review.');
      return;
    }
    setModalTask(task);
    setSocialHandle('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTask || !socialHandle.trim()) return;
    setSubmitting(modalTask.id);
    setError(null);
    const res = await submitTask(modalTask.id, socialHandle.trim());
    if (res.ok) {
      setSuccess('Submitted for admin review! You will receive 30 XENA once approved.');
      setModalTask(null);
      loadData();
    } else {
      setError(res.error || 'Failed to submit task');
    }
    setSubmitting(null);
  };

  const rewardUsd = (30 * xenaUsdPrice).toFixed(4);

  return (
    <div className="space-y-4 animate-fade-in" id="tasks-page-view">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1E1B4B] via-[#6D28D9] to-[#DB2777] rounded-[20px] px-5 py-4 shadow-lg shadow-purple-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#F59E0B]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">Social Tasks</h1>
              <p className="text-sm text-purple-100">Complete social actions, earn <span className="font-bold text-yellow-300">30 XENA</span> per task</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="bg-white/15 backdrop-blur border border-white/25 rounded-xl px-4 py-2">
              <p className="text-[10px] text-purple-200">Your XENA Balance</p>
              <p className="font-bold text-white text-lg">{balances.availableXena.toLocaleString()} XENA</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#EDE9FE] rounded-[16px] p-4 animate-pulse space-y-3">
              <div className="h-12 bg-[#EDE9FE] rounded-xl" />
              <div className="h-4 bg-[#EDE9FE] rounded w-3/4" />
              <div className="h-3 bg-[#EDE9FE] rounded w-1/2" />
              <div className="h-3 bg-[#EDE9FE] rounded w-1/3" />
            </div>
          ))
        ) : tasks.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <AlertCircle className="w-12 h-12 text-[#EDE9FE] mx-auto" />
            <p className="text-[#6B7280] mt-3">No tasks available at the moment</p>
          </div>
        ) : (
          tasks.map((task) => {
            const Icon = PLATFORM_ICONS[task.platform] || Linkedin;
            const color = PLATFORM_COLORS[task.platform] || 'bg-purple-500';
            const status = getSubmissionStatus(task.id);
            const isCompleted = status === 'approved';
            const isPending = status === 'pending';

            return (
              <div key={task.id} className="bg-white border border-[#EDE9FE] rounded-[16px] p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full blur-2xl opacity-50 pointer-events-none" />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#171717] text-sm">{task.title}</h3>
                      <p className="text-[11px] text-[#6B7280]">{PLATFORM_LABELS[task.platform] || task.platform}</p>
                    </div>
                  </div>
                  {isCompleted ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[10px] font-bold text-emerald-700">Completed</span>
                    </div>
                  ) : isPending ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full">
                      <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                      <span className="text-[10px] font-bold text-amber-700">Pending Review</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white rounded-full text-[10px] font-bold">
                      <span>+30 XENA</span>
                      <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[9px]">≈ ${rewardUsd}</span>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-[#6B7280] mt-2 leading-relaxed">{task.description}</p>

                <div className="mt-3 pt-3 border-t border-[#EDE9FE] flex items-center justify-between">
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-bold text-[#6D28D9] hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Link
                  </a>
                  {!isCompleted && !isPending && (
                    <button
                      onClick={() => openModal(task)}
                      className="px-3 py-1.5 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-xs font-bold rounded-lg hover:shadow-md transition-shadow flex items-center gap-1.5"
                    >
                      <Check className="w-3 h-3" /> Submit
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* My Submissions */}
      {mySubmissions.length > 0 && (
        <div className="bg-white border border-[#EDE9FE] rounded-[20px] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-extrabold text-[#171717] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#6D28D9]" /> My Submissions
            </h3>
            <span className="text-xs font-bold text-[#6D28D9] bg-purple-50 px-2 py-1 rounded-full border border-purple-100">
              {mySubmissions.filter(s => s.status === 'approved').length} approved · {mySubmissions.filter(s => s.status === 'pending').length} pending
            </span>
          </div>
          <div className="space-y-2">
            {mySubmissions.map((sub) => {
              const Icon = sub.taskPlatform ? PLATFORM_ICONS[sub.taskPlatform] : null;
              return (
                <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl border bg-[#F8F7FC]">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${PLATFORM_COLORS[sub.taskPlatform || ''] || 'bg-purple-500'} flex items-center justify-center`}>
                      {Icon && <Icon className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <p className="font-bold text-[#171717] text-sm">{sub.taskTitle || 'Task'}</p>
                      <p className="text-[10px] text-[#6B7280]">{sub.socialHandle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.status === 'approved' && (
                      <>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> +30 XENA
                        </span>
                      </>
                    )}
                    {sub.status === 'pending' && (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-spin" /> Under Review
                      </span>
                    )}
                    {sub.status === 'rejected' && (
                      <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-full border border-red-200 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submission Modal */}
      {modalTask && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[20px] max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#EDE9FE] animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-xl ${PLATFORM_COLORS[modalTask.platform]} flex items-center justify-center`}>
                  <PLATFORM_ICONS[modalTask.platform] className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-[#171717]">{modalTask.title}</h3>
              </div>
              <button onClick={() => setModalTask(null)} className="w-7 h-7 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] flex items-center justify-center cursor-pointer font-bold">✕</button>
            </div>

            <p className="text-sm text-[#6B7280]">{modalTask.description}</p>

            <div className="p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#6B7280]">Reward</span><span className="font-bold text-[#6D28D9]">30 XENA ≈ ${rewardUsd}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Platform</span><span className="font-bold">{PLATFORM_LABELS[modalTask.platform]}</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#171717] mb-1">Your Social Handle / Profile URL</label>
                <input
                  type="text"
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  placeholder={modalTask.platform === 'twitter' ? '@yourhandle' : modalTask.platform === 'telegram' ? '@yourusername' : 'your profile URL'}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] placeholder:text-[#9CA3AF]"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting === modalTask.id || !socialHandle.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs hover:opacity-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submitting === modalTask.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit for Review'}
              </button>
            </form>

            <p className="text-[10px] text-[#6B7280] text-center">
              Admin will verify your submission. Rewards credited within 24h after approval.
            </p>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <Check className="w-5 h-5" /> {success}
          </div>
        </div>
      )}
    </div>
  );
};