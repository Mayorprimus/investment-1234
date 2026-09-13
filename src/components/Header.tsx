import React, { useState } from 'react';
import { Search, Bell, User, Menu, X, ChevronDown, Shield, ArrowUpRight, Settings } from 'lucide-react';
import { XenaLogo } from './XenaLogo';
import { UserProfile, NotificationItem } from '../types';

interface HeaderProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  user: UserProfile;
  notifications: NotificationItem[];
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
  onOpenSecurity: () => void;
  onSignOut: () => void;
  signedIn?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  user,
  notifications,
  onOpenNotifications,
  onOpenSearch,
  onOpenSecurity,
  onSignOut,
  signedIn = true,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'market', label: 'Markets' },
    { id: 'investments', label: 'Earn' },
    { id: 'p2p', label: 'P2P' },
    { id: 'wallet', label: 'Wallet' },
    { id: 'profile', label: 'Profile' },
    { id: 'transactions', label: 'Activity' },
    { id: 'announcements', label: 'News' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#EDE9FE]" id="xena-main-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Nav */}
          <div className="flex items-center gap-6 sm:gap-10">
            <button
              onClick={() => onSelectTab('home')}
              className="flex items-center gap-2 text-left focus:outline-none cursor-pointer"
              aria-label="Xena Home"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#DB2777] flex items-center justify-center shadow-md shadow-fuchsia-300/50">
                <span className="text-white font-bold text-lg leading-none">X</span>
              </div>
              <span className="font-bold text-xl tracking-tight text-gradient">XENA</span>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`relative py-4 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-[#6D28D9] font-bold border-b-2 border-[#6D28D9]'
                        : 'text-[#6B7280] hover:text-[#6D28D9]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Side Tools */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Search input styled per Clean Utility theme */}
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="Search assets..."
                onClick={onOpenSearch}
                readOnly
                className="bg-[#F8F7FC] border border-[#EDE9FE] rounded-full px-4 py-1.5 text-xs w-44 lg:w-52 focus:outline-none focus:ring-1 focus:ring-[#6D28D9] cursor-pointer text-[#171717] placeholder-[#6B7280]"
              />
              <kbd className="absolute right-2.5 top-1.5 text-[10px] bg-white border border-[#EDE9FE] px-1.5 py-0.5 rounded text-[#6B7280] shadow-2xs pointer-events-none">
                ⌘K
              </kbd>
            </div>

            {/* Mobile search icon button */}
            <button
              onClick={onOpenSearch}
              className="sm:hidden p-2 text-[#6B7280] hover:text-[#171717] rounded-full bg-[#F8F7FC] border border-[#EDE9FE]"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications with red dot badge */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-[#6B7280] hover:text-[#171717] rounded-full hover:bg-[#F8F7FC] transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute 1.5 top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {/* Profile Avatar & Menu */}
            <div className="relative">
              {signedIn ? (
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-[#F8F7FC] transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#F8F7FC] border border-[#EDE9FE] text-[#6D28D9] font-bold text-xs flex items-center justify-center shadow-2xs">
                  {user.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="hidden lg:block text-left text-xs">
                  <span className="font-bold text-[#171717] block leading-tight">{user.name}</span>
                  <span className="text-[10px] text-[#6B7280]">{user.kycTier}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] hidden lg:block" />
              </button>
              ) : (
              <button
                onClick={() => onSelectTab('login')}
                className="flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-md transition-all cursor-pointer"
              >
                Sign In
              </button>
              )}

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#EDE9FE] py-2 z-50 animate-fade-in">
                  <div className="px-4 py-2.5 border-b border-[#EDE9FE] bg-[#F8F7FC]">
                    <div className="font-bold text-xs text-[#171717]">{user.name}</div>
                    <div className="text-[11px] text-[#6B7280]">{user.email}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-[#6D28D9]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
                      ID: {user.xenaId} · {user.xenaCode}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onSelectTab('profile');
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-[#171717] hover:bg-[#F8F7FC] flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-4 h-4 text-[#7C3AED]" />
                      My Profile & Security Hub
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onSelectTab('wallet');
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-[#171717] hover:bg-[#F8F7FC] flex items-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-[#7C3AED]" />
                      Wallet & Assets
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onSelectTab('settings');
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-[#171717] hover:bg-[#F8F7FC] flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-[#7C3AED]" />
                      Account Settings
                    </button>
                    {user.role === 'admin' && (
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onSelectTab('admin');
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-[#171717] hover:bg-[#F8F7FC] flex items-center gap-2 cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-slate-700" />
                        Admin Panel
                      </button>
                    )}
                  </div>

                  <div className="py-1 border-t border-[#EDE9FE]">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onSignOut();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Switch Account / Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#6B7280] hover:text-[#171717] rounded-xl hover:bg-[#F8F7FC] border border-[#EDE9FE]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#EDE9FE] px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === item.id
                  ? 'bg-purple-50 text-[#6D28D9] font-bold'
                  : 'text-[#6B7280] hover:bg-[#F8F7FC] hover:text-[#171717]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};
