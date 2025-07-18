
import React, { useState } from 'react';

const JsonValue: React.FC<{ value: any }> = ({ value }) => {
    const type = typeof value;
    if (value === null) {
        return <span className="text-slate-500">null</span>;
    }
    switch (type) {
        case 'string':
            return <span className="text-amber-400">"{value}"</span>;
        case 'number':
            return <span className="text-green-400">{value}</span>;
        case 'boolean':
            return <span className="text-purple-400">{value.toString()}</span>;
        default:
            return <span className="text-slate-400">...</span>;
    }
};

const JsonTreeViewNode: React.FC<{
    jsonKey: string;
    value: any;
    path: string;
    onSelect: (path: string) => void;
    selectedPath: string;
    isLast: boolean;
}> = ({ jsonKey, value, path, onSelect, selectedPath, isLast }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const isObject = typeof value === 'object' && value !== null;
    const isSelected = selectedPath === path;

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(path);
    };

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isObject) {
            setIsExpanded(!isExpanded);
        }
    };
    
    const entries = isObject ? Object.entries(value) : [];

    return (
        <div className="font-mono text-xs">
            <div
                className={`flex items-center cursor-pointer p-1 rounded-md ${isSelected ? 'bg-sky-500/20' : 'hover:bg-slate-700/50'}`}
                onClick={isObject ? toggleExpand : handleSelect}
            >
                {isObject && (
                    <span className="w-4 text-slate-500">{isExpanded ? '▼' : '►'}</span>
                )}
                <span className="text-sky-400 ml-2" onClick={handleSelect}>{jsonKey}:</span>
                {!isExpanded && isObject && (
                     <span className="text-slate-500 ml-2">{Array.isArray(value) ? `[${entries.length}]` : `{...}`}</span>
                )}
                 {!isObject && (
                    <span className="ml-2" onClick={handleSelect}>
                        <JsonValue value={value} />
                        {!isLast && <span className="text-slate-500">,</span>}
                    </span>
                )}
            </div>
            {isExpanded && isObject && (
                <div className="pl-4 border-l border-slate-700/50 ml-2">
                    {entries.map(([key, val], index) => (
                        <JsonTreeViewNode
                            key={key}
                            jsonKey={key}
                            value={val}
                            path={`${path}.${key}`}
                            onSelect={onSelect}
                            selectedPath={selectedPath}
                            isLast={index === entries.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const JsonTreeView: React.FC<{ data: any; onSelect: (path: string) => void, selectedPath: string }> = ({ data, onSelect, selectedPath }) => {
    return (
        <div className="p-2 bg-slate-900/70 rounded-md">
            {Object.entries(data).map(([key, value]) => (
                <JsonTreeViewNode key={key} jsonKey={key} value={value} path={key} onSelect={onSelect} selectedPath={selectedPath} isLast={false}/>
            ))}
        </div>
    );
};

export default JsonTreeView;
