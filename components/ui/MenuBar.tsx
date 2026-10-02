import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon, FolderOpenIcon, SaveIcon, SunIcon, MoonIcon } from './Icons';

interface MenuBarProps {
    onSave: () => void;
    onLoad: () => void;
    onExport: () => void;
    onExportAudio: () => void;
    onShowShortcuts: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onOpenSettings: () => void;
    onToggleTheme: () => void;
    isDarkMode: boolean;
    activeWorkspace: 'source' | 'properties' | 'color';
    onWorkspaceChange: (workspace: 'source' | 'properties' | 'color') => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
    onSave, onLoad, onExport, onExportAudio, onShowShortcuts, onUndo, onRedo,
    onOpenSettings, onToggleTheme, isDarkMode, activeWorkspace, onWorkspaceChange
}) => {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const headerRef = useRef<HTMLElement>(null);
    useEffect(() => {
        const dismiss = (event: PointerEvent) => {
            if (!headerRef.current?.contains(event.target as Node)) setActiveMenu(null);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setActiveMenu(null);
        };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('keydown', escape);
        };
    }, []);
    const menus = {
        File: [
            { label: 'Open project', action: onLoad },
            { label: 'Save project', action: onSave },
            { label: 'Export video', action: onExport },
            { label: 'Export audio', action: onExportAudio }
        ],
        Edit: [
            { label: 'Undo', action: onUndo },
            { label: 'Redo', action: onRedo },
            { label: 'Keyboard shortcuts', action: onShowShortcuts }
        ],
        More: [
            { label: 'Open project', action: onLoad },
            { label: 'Undo', action: onUndo },
            { label: 'Redo', action: onRedo },
            { label: 'Export audio', action: onExportAudio },
            { label: 'Keyboard shortcuts', action: onShowShortcuts },
            { label: isDarkMode ? 'Switch to light theme' : 'Switch to dark theme', action: onToggleTheme },
            { label: 'Settings & AI key', action: onOpenSettings }
        ]
    };
    const menu = (name: keyof typeof menus, label: string = name) => (
        <div className="editor-menu">
            <button className="header-menu-trigger" aria-label={name === 'More' ? 'More actions' : `${name} menu`}
                aria-expanded={activeMenu === name} aria-controls={`menu-${name}`}
                onClick={() => setActiveMenu(activeMenu === name ? null : name)}>{label}</button>
            {activeMenu === name && (
                <div className="editor-dropdown" id={`menu-${name}`} aria-label={`${name} actions`}>
                    {menus[name].map(item => (
                        <button key={item.label} onClick={() => { setActiveMenu(null); item.action(); }}>{item.label}</button>
                    ))}
                </div>
            )}
        </div>
    );
    return (
        <header ref={headerRef} className="editor-header">
            <div className="header-main">
                <a className="editor-brand" href="/" aria-label="Motion Labs home">
                    <img src="/favicon.svg" alt="" width="36" height="36" />
                    <span>motion<span className="brand-light">labs</span><small>YOUR IDEAS, IN MOTION</small></span>
                </a>
                <div className="header-actions">
                    <button className="header-button open-project" onClick={onLoad}><FolderOpenIcon className="w-4 h-4" /><span>Open</span></button>
                    <button className="header-button" onClick={onSave} aria-label="Save project"><SaveIcon className="w-4 h-4" /><span className="save-label">Save</span></button>
                    <button className="header-button primary" onClick={onExport}><DownloadIcon className="w-4 h-4" /><span>Export</span></button>
                    <button className="header-button theme-button" onClick={onToggleTheme} aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}>{isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}</button>
                    {menu('More', '•••')}
                </div>
            </div>
            <div className="header-toolbar">
                <nav className="header-menus" aria-label="Project actions">{menu('File')}{menu('Edit')}<button className="header-menu-trigger" onClick={onOpenSettings}>Settings</button></nav>
                <nav className="workspace-switcher" aria-label="Workspace">
                    {([['source', 'Source'], ['properties', 'Properties'], ['color', 'Color']] as const).map(([id, name]) => (
                        <button key={id} aria-pressed={activeWorkspace === id} className={activeWorkspace === id ? 'selected' : ''} onClick={() => onWorkspaceChange(id)}>{name}</button>
                    ))}
                </nav>
                <button className="shortcut-hint" onClick={onShowShortcuts}>Keyboard shortcuts <kbd>?</kbd></button>
            </div>
        </header>
    );
};
export default MenuBar;
