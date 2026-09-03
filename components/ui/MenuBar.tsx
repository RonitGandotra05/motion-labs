import React, { useState } from 'react';

interface MenuBarProps {
    onSave?: () => void;
    onLoad?: () => void;
    onExport?: () => void;
    onExportAudio?: () => void;
    onShowShortcuts?: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({ onSave, onLoad, onExport, onExportAudio, onShowShortcuts }) => {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [activeWorkspace, setActiveWorkspace] = useState('Editing');

    const menus = [
        {
            label: 'File',
            items: [
                { label: 'New Project', shortcut: 'Ctrl+N', action: () => { } },
                { label: 'Open Project...', shortcut: 'Ctrl+O', action: onLoad },
                { type: 'separator' as const },
                { label: 'Save', shortcut: 'Ctrl+S', action: onSave },
                { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: onSave },
                { type: 'separator' as const },
                { label: 'Export Media...', shortcut: 'Ctrl+M', action: onExport },
                { label: 'Export Audio...', action: onExportAudio },
            ]
        },
        {
            label: 'Edit',
            items: [
                { label: 'Undo', shortcut: 'Ctrl+Z', action: () => { } },
                { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: () => { } },
                { type: 'separator' as const },
                { label: 'Cut', shortcut: 'Ctrl+X', action: () => { } },
                { label: 'Copy', shortcut: 'Ctrl+C', action: () => { } },
                { label: 'Paste', shortcut: 'Ctrl+V', action: () => { } },
                { type: 'separator' as const },
                { label: 'Select All', shortcut: 'Ctrl+A', action: () => { } },
                { label: 'Deselect All', shortcut: 'Ctrl+Shift+A', action: () => { } },
                { type: 'separator' as const },
                { label: 'Keyboard Shortcuts...', action: onShowShortcuts },
            ]
        },
        {
            label: 'Clip',
            items: [
                { label: 'Rename...', action: () => { } },
                { type: 'separator' as const },
                { label: 'Speed/Duration...', shortcut: 'Ctrl+R', action: () => { } },
                { type: 'separator' as const },
                { label: 'Nest...', action: () => { } },
            ]
        },
        {
            label: 'Sequence',
            items: [
                { label: 'Render In to Out', shortcut: 'Enter', action: () => { } },
                { type: 'separator' as const },
                { label: 'Add Tracks...', action: () => { } },
                { label: 'Delete Tracks...', action: () => { } },
                { type: 'separator' as const },
                { label: 'Snap in Timeline', shortcut: 'S', action: () => { } },
            ]
        },
        {
            label: 'Markers',
            items: [
                { label: 'Add Marker', shortcut: 'M', action: () => { } },
                { label: 'Go to Next Marker', shortcut: 'Shift+M', action: () => { } },
                { label: 'Go to Previous Marker', shortcut: 'Ctrl+Shift+M', action: () => { } },
                { type: 'separator' as const },
                { label: 'Clear All Markers', action: () => { } },
            ]
        },
        {
            label: 'Graphics',
            items: [
                { label: 'New Text Layer', shortcut: 'Ctrl+T', action: () => { } },
            ]
        },
        {
            label: 'View',
            items: [
                { label: 'Zoom In', shortcut: '=', action: () => { } },
                { label: 'Zoom Out', shortcut: '-', action: () => { } },
                { type: 'separator' as const },
                { label: 'Fit Clip in Window', shortcut: 'Shift+Z', action: () => { } },
            ]
        },
        {
            label: 'Window',
            items: [
                { label: 'Effects', action: () => { } },
                { label: 'Effect Controls', action: () => { } },
                { label: 'Audio Mixer', action: () => { } },
                { type: 'separator' as const },
                { label: 'Reset Current Workspace', action: () => { } },
            ]
        },
        {
            label: 'Help',
            items: [
                { label: 'Keyboard Shortcuts...', action: onShowShortcuts },
            ]
        },
    ];

    const workspaces = ['Assembly', 'Editing', 'Color', 'Effects', 'Audio', 'Graphics'];

    return (
        <>
            <div className="flex items-center h-[26px] bg-pp-menu-bg select-none text-[11px] relative z-[100]"
                onMouseLeave={() => setActiveMenu(null)}
            >
                {/* Motion Labs Logo */}
                <div className="flex items-center justify-center px-4 h-full border-r border-black/30">
                    <span className="text-[12px] font-bold text-pp-text-bright tracking-tight">Motion Labs</span>
                </div>

                {/* Menu items */}
                <div className="flex items-center h-full">
                    {menus.map((menu) => (
                        <div key={menu.label} className="relative h-full">
                            <button
                                className={`h-full px-2.5 text-[11px] transition-colors ${activeMenu === menu.label
                                    ? 'bg-pp-light text-pp-text-bright'
                                    : 'text-pp-text hover:bg-pp-menu-hover hover:text-pp-text-bright'
                                    }`}
                                onMouseDown={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
                                onMouseEnter={() => {
                                    if (activeMenu) setActiveMenu(menu.label);
                                }}
                            >
                                {menu.label}
                            </button>

                            {/* Dropdown */}
                            {activeMenu === menu.label && (
                                <div className="absolute top-full left-0 min-w-[200px] pp-context-menu z-[200]">
                                    {menu.items.map((item, idx) =>
                                        'type' in item && item.type === 'separator' ? (
                                            <div key={idx} className="pp-context-menu-separator" />
                                        ) : (
                                            <div
                                                key={idx}
                                                className="pp-context-menu-item flex items-center justify-between"
                                                onClick={() => {
                                                    if ('action' in item && item.action) item.action();
                                                    setActiveMenu(null);
                                                }}
                                            >
                                                <span>{'label' in item ? item.label : ''}</span>
                                                {'shortcut' in item && item.shortcut && (
                                                    <span className="text-pp-text-dim text-[10px] ml-8">{item.shortcut}</span>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Center - Title */}
                <div className="flex-1 text-center text-pp-text-dim text-[11px]">

                </div>

                {/* Workspace Tabs */}
                <div className="flex items-center h-full mr-2 space-x-0.5">
                    {workspaces.map(ws => (
                        <button
                            key={ws}
                            className={`h-full px-2.5 text-[10px] transition-colors ${activeWorkspace === ws
                                ? 'bg-pp-tab-active text-pp-accent font-medium border-b border-pp-accent'
                                : 'text-pp-text-dim hover:text-pp-text hover:bg-pp-menu-hover'
                                }`}
                            onClick={() => setActiveWorkspace(ws)}
                        >
                            {ws}
                        </button>
                    ))}
                </div>
            </div>

            {/* Click away overlay */}
            {activeMenu && (
                <div
                    className="fixed inset-0 z-[99]"
                    onClick={() => setActiveMenu(null)}
                />
            )}
        </>
    );
};

export default MenuBar;
