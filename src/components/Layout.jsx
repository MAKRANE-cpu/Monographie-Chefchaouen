import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, FileText, Settings, Leaf } from 'lucide-react';

const Layout = ({ children }) => {
    return (
        <div className="flex flex-col h-screen overflow-hidden text-slate-100">
            {/* Header */}
            <header className="glass-header px-6 py-4 flex items-center gap-3 z-20 shadow-sm">
                <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                    <Leaf size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                        Agri-Dashboard
                    </h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Chefchaouen Data</p>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 pb-24 relative">
                {/* Background blobs for depth */}
                <div className="absolute top-0 left-0 w-full h-64 bg-indigo-600/5 blur-[100px] pointer-events-none" />
                <div className="relative z-10 w-full max-w-md mx-auto">
                    {children}
                </div>
            </main>

            {/* Navigation */}
            <nav className="fixed bottom-4 left-4 right-4 glass-nav rounded-2xl flex justify-between px-6 py-4 shadow-2xl shadow-black/50 z-30 max-w-md mx-auto border border-white/10">
                <NavItem to="/" icon={<LayoutDashboard size={22} />} label="Data" />
                <NavItem to="/chat" icon={<MessageSquare size={22} />} label="Assistant" />
                <NavItem to="/report" icon={<FileText size={22} />} label="Rapport" />
                <NavItem to="/settings" icon={<Settings size={22} />} label="Config" />
            </nav>
        </div>
    );
};

const NavItem = ({ to, icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-all duration-300 ${isActive
                ? 'text-indigo-400 scale-110 drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]'
                : 'text-slate-500 hover:text-slate-300'
            }`
        }
    >
        {icon}
        {/* Label hidden on very small screens for cleaner look, or kept small */}
        <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </NavLink>
);

export default Layout;
