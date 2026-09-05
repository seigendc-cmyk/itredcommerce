import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Folder, 
  ShoppingCart, 
  ListTree, 
  Boxes, 
  Users, 
  Coins, 
  BarChart3, 
  Lock, 
  ChevronDown, 
  ChevronRight,
  ChevronUp,
  Clock, 
  HardDrive, 
  ArrowLeftRight,
  Home,
  Menu,
  X,
  Search,
  CheckCircle2,
  Layers,
  Settings
} from 'lucide-react';
import { StaffMember, ActiveView, MenuGroup, MenuItem } from '../../types';
import { APPLICATION_MENU_GROUPS } from '../../data/mockData';
import { filterMenuGroupsForRoleAndLock } from '../../utils/accessRoleGate';

export interface HeaderNavProps {
  currentStaff: StaffMember;
  activeView: ActiveView;
  onNavigate: (view: ActiveView, customParams?: any) => void;
  onLockSession: () => void;
  onSwitchStaff: () => void;
  // DL-040/DL-048: hides Sales/Purchasing menu entries when true.
  moduleLocked: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentStaff,
  activeView,
  onNavigate,
  onLockSession,
  onSwitchStaff,
  moduleLocked,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isAccordionDrawerOpen, setIsAccordionDrawerOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    File: true,
    Cart: true,
    Lists: true,
    Inventory: true,
    Employees: true,
    Financial: true,
    Reports: true,
    System: true,
  });
  const [currentTime, setCurrentTime] = useState<string>('');
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const drawerSearchInputRef = useRef<HTMLInputElement>(null);

  // DL-002/DL-005/DL-040/DL-048: hide head-office-only modules from a
  // till-operator session's menus entirely, and hide Sales/Purchasing
  // when the module lock is engaged — rather than just relying on the
  // deeper App.tsx-level navigation gate. See src/utils/accessRoleGate.ts.
  const menuGroups = useMemo(
    () => filterMenuGroupsForRoleAndLock(APPLICATION_MENU_GROUPS, currentStaff.accessRole, moduleLocked),
    [currentStaff.accessRole, moduleLocked]
  );

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global hotkeys (Alt+M / F9 for Accordion Menu, Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && (e.key === 'm' || e.key === 'M')) || e.key === 'F9') {
        e.preventDefault();
        setIsAccordionDrawerOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        if (isAccordionDrawerOpen) {
          setIsAccordionDrawerOpen(false);
        }
        if (openMenu) {
          setOpenMenu(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccordionDrawerOpen, openMenu]);

  // Focus search input when drawer opens
  useEffect(() => {
    if (isAccordionDrawerOpen) {
      setTimeout(() => {
        drawerSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isAccordionDrawerOpen]);

  // Click outside to close top bar dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const expandAllGroups = () => {
    const updated: Record<string, boolean> = {};
    menuGroups.forEach(g => {
      updated[g.name] = true;
    });
    setExpandedGroups(updated);
  };

  const collapseAllGroups = () => {
    const updated: Record<string, boolean> = {};
    menuGroups.forEach(g => {
      updated[g.name] = false;
    });
    setExpandedGroups(updated);
  };

  const getGroupIcon = (name: string, className = "w-3.5 h-3.5") => {
    switch (name) {
      case 'File': return <Folder className={className} />;
      case 'Cart': return <ShoppingCart className={className} />;
      case 'Lists': return <ListTree className={className} />;
      case 'Inventory': return <Boxes className={className} />;
      case 'Employees': return <Users className={className} />;
      case 'Financial': return <Coins className={className} />;
      case 'Reports': return <BarChart3 className={className} />;
      case 'System': return <Settings className={className} />;
      default: return <Folder className={className} />;
    }
  };

  const handleMenuItemClick = (item: MenuItem) => {
    setOpenMenu(null);
    setIsAccordionDrawerOpen(false);
    onNavigate(item.viewTarget, { menuItemId: item.id, itemTitle: item.label });
  };

  // Filter modules based on search text
  const trimmedFilter = searchFilter.trim().toLowerCase();
  const filteredGroups = menuGroups.map(group => {
    const matchingItems = group.items.filter(item => {
      if (!trimmedFilter) return true;
      return (
        item.label.toLowerCase().includes(trimmedFilter) ||
        (item.description && item.description.toLowerCase().includes(trimmedFilter)) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(trimmedFilter)) ||
        group.label.toLowerCase().includes(trimmedFilter) ||
        item.viewTarget.toLowerCase().includes(trimmedFilter)
      );
    });
    return {
      ...group,
      items: matchingItems
    };
  }).filter(group => !trimmedFilter || group.items.length > 0);

  const totalModuleCount = menuGroups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <>
      <header className="sticky top-0 z-40 select-none flex flex-col shadow-xs bg-white">
        {/* Top Application Bar - Sleek Orange Header */}
        <div className="h-12 bg-[#FF6B00] text-white flex items-center justify-between px-4 shrink-0 shadow-sm border-b border-[#E05E00]">
          {/* Brand / Logo + Accordion Menu Launcher */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onNavigate('LANDING')}
              className="flex items-center space-x-2 group cursor-pointer text-left focus:outline-none"
              title="Go to Home Landing"
            >
              <div className="font-black text-xl tracking-tighter italic select-none">
                iTred<span className="font-light not-italic">Commerce</span>
              </div>
            </button>

            <div className="h-6 w-[1px] bg-white/20 mx-2 hidden sm:block" />

            <div className="hidden sm:block text-xs font-semibold uppercase tracking-widest text-white/90">
              Industrial Core Workstation
            </div>

            <div className="hidden md:block h-6 w-[1px] bg-white/20 mx-2" />

            {/* Prominent All-Modules Accordion Menu Button */}
            <button
              type="button"
              id="header-accordion-menu-trigger"
              onClick={() => setIsAccordionDrawerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-black/30 hover:bg-black/40 text-white border border-white/30 hover:border-white/60 transition-all cursor-pointer shadow-xs"
              title="Open All Modules Accordion Menu (Alt+M / F9)"
            >
              <Menu className="w-3.5 h-3.5 text-amber-300" />
              <span>All Modules</span>
              <span className="hidden lg:inline text-[10px] bg-white/20 px-1 py-0.2 font-mono text-white/90">
                {totalModuleCount}
              </span>
              <span className="hidden xl:inline text-[10px] text-amber-200 font-mono">
                [Alt+M]
              </span>
            </button>

            {/* Quick Home action */}
            <button
              type="button"
              onClick={() => onNavigate('LANDING')}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer rounded-none ${
                activeView === 'LANDING'
                  ? 'bg-black/20 text-white border-white/40'
                  : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Landing</span>
            </button>
          </div>

          {/* System telemetry & active staff */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            {/* Operational Readiness status badge */}
            <button
              type="button"
              onClick={() => onNavigate('OPERATIONAL_READINESS')}
              className="flex items-center bg-black/10 hover:bg-black/20 px-3 py-1 rounded-sm border border-white/20 text-xs font-medium cursor-pointer transition-all focus:outline-hidden"
              title="Inspect POS Operational Readiness & Health"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 shadow-2xs animate-pulse" />
              <span className="hidden sm:inline">Offline — Local POS Ready</span>
              <span className="sm:hidden font-mono">READY</span>
            </button>

            {/* Terminal ID */}
            <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-white/10 border border-white/20 text-white text-[11px] font-mono">
              <HardDrive className="w-3 h-3 text-white/80" />
              <span>POS-D01</span>
            </div>

            {/* Clock */}
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-white/10 border border-white/20 text-white text-[11px] font-mono">
              <Clock className="w-3 h-3 text-white/80" />
              <span>{currentTime}</span>
            </div>

            {/* Active Staff profile */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white/10 flex items-center justify-center border border-white/20 text-xs font-bold text-white">
                {currentStaff?.avatarInitials || 'OP'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-white leading-tight">
                  {currentStaff?.name ? currentStaff.name.split(' ')[0] : 'Operator'}
                </div>
                <div className="text-[10px] text-white/80 font-mono">
                  {currentStaff?.roleTitle || 'Staff'}
                </div>
              </div>
            </div>

            {/* Switch Operator */}
            <button
              type="button"
              onClick={onSwitchStaff}
              className="p-1 px-2 text-[11px] bg-white/10 hover:bg-white/20 text-white border border-white/20 cursor-pointer flex items-center gap-1 transition-colors"
              title="Switch Operator"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span className="hidden md:inline">Switch</span>
            </button>

            {/* Lock / Exit */}
            <button
              type="button"
              onClick={onLockSession}
              className="p-1 px-2 text-[11px] bg-black/20 hover:bg-rose-900/80 text-white border border-white/20 hover:border-rose-400 cursor-pointer flex items-center gap-1 transition-colors"
              title="Lock Register Session"
            >
              <Lock className="w-3 h-3 text-rose-200" />
              <span className="hidden md:inline">Lock</span>
            </button>
          </div>
        </div>

        {/* Sleek Sub-navigation Menu Bar */}
        <div
          ref={menuContainerRef}
          className="h-10 bg-white border-b border-gray-200 flex items-center px-4 space-x-2 sm:space-x-6 text-[13px] font-semibold shrink-0 shadow-2xs relative z-30 overflow-visible"
        >
          {/* Quick Accordion Icon Trigger */}
          <button
            type="button"
            onClick={() => setIsAccordionDrawerOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#FF6B00] hover:bg-orange-50 border border-orange-200 cursor-pointer transition-colors"
            title="Open Module Accordion Hub (Alt+M / F9)"
          >
            <Layers className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="hidden sm:inline uppercase tracking-wider text-[11px]">All Modules</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-300 hidden sm:block" />

          {/* Category Dropdowns */}
          <div className="flex items-center space-x-1 sm:space-x-4 overflow-visible">
            {menuGroups.map((group, groupIdx) => {
              const isOpen = openMenu === group.name;
              const isRightAligned = groupIdx >= menuGroups.length - 3;
              return (
                <div key={group.name} className="relative h-full flex items-center">
                  <button
                    type="button"
                    onClick={() => setOpenMenu(isOpen ? null : group.name)}
                    className={`flex items-center space-x-1 cursor-pointer py-2 px-2 transition-colors select-none border-b-2 text-xs uppercase tracking-wider ${
                      isOpen
                        ? 'text-[#FF6B00] border-[#FF6B00] font-bold bg-orange-50/60'
                        : 'text-gray-700 hover:text-[#FF6B00] border-transparent hover:border-[#FF6B00]'
                    }`}
                  >
                    {getGroupIcon(group.name, "w-3.5 h-3.5")}
                    <span>{group.label}</span>
                    <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-180 text-[#FF6B00]' : ''}`} />
                  </button>

                  {/* Dropdown Menu Items - Guaranteed Top Layering Directly Below Subnav */}
                  {isOpen && (
                    <div 
                      className={`absolute top-full mt-0.5 w-80 bg-white border border-gray-300 shadow-2xl z-[9999] rounded-none py-1 animate-in fade-in zoom-in-95 duration-100 ${
                        isRightAligned ? 'right-0 left-auto' : 'left-0 right-auto'
                      }`}
                      style={{
                        boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.35), 0 10px 15px -5px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <div className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[#FF6B00] border-b border-gray-200 bg-gray-50 font-bold flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {getGroupIcon(group.name, "w-3 h-3 text-[#FF6B00]")}
                          <span>{group.name} Operations</span>
                        </div>
                        <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.2 font-sans font-semibold">
                          {group.items.length} items
                        </span>
                      </div>
                      <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100">
                        {group.items.map((item) => {
                          const isActive = activeView === item.viewTarget;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleMenuItemClick(item)}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer group select-none ${
                                isActive 
                                  ? 'bg-orange-100/70 text-[#FF6B00] font-bold border-l-4 border-[#FF6B00]' 
                                  : 'text-gray-800 hover:bg-orange-50 hover:text-[#FF6B00]'
                              }`}
                            >
                              <div className="pr-2 flex-1">
                                <div className="flex items-center gap-1.5 font-semibold text-gray-900 group-hover:text-[#FF6B00]">
                                  <span>{item.label}</span>
                                  {isActive && (
                                    <span className="text-[9px] font-mono uppercase bg-[#FF6B00] text-white px-1 py-0.2 rounded-xs">
                                      Active
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <div className="text-[11px] text-gray-500 group-hover:text-orange-800 line-clamp-1 leading-normal mt-0.5">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              {item.shortcut && (
                                <span className="shrink-0 ml-2 px-1.5 py-0.5 text-[10px] font-mono uppercase bg-gray-100 text-gray-700 group-hover:bg-[#FF6B00] group-hover:text-white border border-gray-200 group-hover:border-[#FF6B00] transition-colors">
                                  {item.shortcut}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-1.5 bg-gray-50 border-t border-gray-200 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            setIsAccordionDrawerOpen(true);
                          }}
                          className="w-full py-1 text-[11px] text-[#FF6B00] hover:text-orange-700 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Layers className="w-3 h-3" />
                          <span>View Full Accordion Drawer (Alt+M)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* FULL-SCREEN OVERLAY ACCORDION DRAWER - HIGHEST Z-INDEX (SHOWN ON TOP OF ALL FEATURES) */}
      {isAccordionDrawerOpen && (
        <div 
          id="pos-accordion-menu-overlay"
          className="fixed inset-0 z-[99999] flex justify-end animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="Application Modules Navigation Hub"
        >
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsAccordionDrawerOpen(false)}
          />

          {/* Accordion Drawer Content */}
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-[100000] border-l border-gray-300 text-gray-900">
            {/* Drawer Header */}
            <div className="p-4 bg-[#FF6B00] text-white flex items-center justify-between border-b border-[#E05E00] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-black/20 flex items-center justify-center border border-white/20">
                  <Layers className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase tracking-wide flex items-center gap-2">
                    <span>Application Modules Hub</span>
                    <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 text-white">
                      {totalModuleCount} Modules
                    </span>
                  </h2>
                  <p className="text-xs text-white/80">
                    Industrial Core Workstation • Unified Navigation & Accordion Control
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAccordionDrawerOpen(false)}
                className="p-1.5 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 border border-white/20 cursor-pointer transition-colors"
                title="Close Accordion Menu (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Expansion Controls */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  ref={drawerSearchInputRef}
                  type="text"
                  placeholder="Search modules by name, keyword, shortcut, or view..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={expandAllGroups}
                  className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 cursor-pointer transition-colors"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllGroups}
                  className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 cursor-pointer transition-colors"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Accordion Modules Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-100">
              {filteredGroups.length === 0 ? (
                <div className="p-8 text-center bg-white border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700">No matching modules found</p>
                  <p className="text-xs text-gray-500 mt-1">Try searching for different terms like "Sale", "Stock", "Report", or "Tax"</p>
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="mt-3 px-3 py-1 text-xs bg-[#FF6B00] text-white font-medium cursor-pointer"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const isExpanded = trimmedFilter ? true : !!expandedGroups[group.name];
                  const hasActiveChild = group.items.some(it => it.viewTarget === activeView);

                  return (
                    <div 
                      key={group.name}
                      className={`border bg-white shadow-xs transition-all ${
                        hasActiveChild ? 'border-[#FF6B00] ring-1 ring-orange-200' : 'border-gray-200'
                      }`}
                    >
                      {/* Accordion Group Header Button */}
                      <button
                        type="button"
                        onClick={() => toggleGroupExpansion(group.name)}
                        className={`w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer transition-colors select-none ${
                          hasActiveChild 
                            ? 'bg-orange-50/80 text-[#FF6B00]' 
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className={`p-1.5 rounded-xs ${hasActiveChild ? 'bg-[#FF6B00] text-white' : 'bg-gray-200 text-gray-700'}`}>
                            {getGroupIcon(group.name, "w-4 h-4")}
                          </div>
                          <div>
                            <div className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                              <span>{group.label} Operations</span>
                              {hasActiveChild && (
                                <span className="text-[10px] font-mono bg-[#FF6B00] text-white px-1.5 py-0.2 rounded-xs font-semibold">
                                  Current Section
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 font-normal">
                              {group.items.length} relative {group.items.length === 1 ? 'module' : 'modules'} available
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-white border border-gray-200 text-gray-600">
                            {group.items.length}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </button>

                      {/* Accordion Item Panel */}
                      {isExpanded && (
                        <div className="divide-y divide-gray-100 border-t border-gray-200 bg-white">
                          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                            {group.items.map((item) => {
                              const isActive = activeView === item.viewTarget;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleMenuItemClick(item)}
                                  className={`p-3 text-left flex flex-col justify-between transition-all cursor-pointer group hover:bg-orange-50/60 ${
                                    isActive 
                                      ? 'bg-orange-50 text-[#FF6B00] font-semibold border-l-4 border-l-[#FF6B00]' 
                                      : 'text-gray-800'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-bold text-xs text-gray-900 group-hover:text-[#FF6B00]">
                                        {item.label}
                                      </span>
                                      {item.shortcut && (
                                        <span className="text-[10px] font-mono uppercase bg-gray-100 group-hover:bg-[#FF6B00] text-gray-700 group-hover:text-white px-1.5 py-0.5 border border-gray-200 group-hover:border-[#FF6B00] transition-colors shrink-0">
                                          {item.shortcut}
                                        </span>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p className="text-[11px] text-gray-500 group-hover:text-gray-700 mt-1 leading-snug">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>

                                  <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                                    <span className="uppercase text-gray-500">{item.viewTarget}</span>
                                    {isActive ? (
                                      <span className="text-[#FF6B00] font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Active
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 group-hover:text-[#FF6B00] flex items-center gap-0.5">
                                        Launch Module
                                        <ChevronRight className="w-2.5 h-2.5 inline" />
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer with System Status */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs flex items-center justify-between text-gray-600 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium">Local Mode Ready (Offline-First)</span>
              </div>
              <div className="text-[11px] text-gray-500">
                Press <kbd className="px-1.5 py-0.5 bg-gray-200 border border-gray-300 font-mono text-[10px]">Esc</kbd> to close
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
