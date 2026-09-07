import { THEME } from '../config';
import {
    AnalysisResultData,
    ButtonProps,
    ResultFilters,
    SectionProps,
    StatusMessage,
    ThemeColors,
} from '../types';
import { parseSummaryStats } from '../utils/summaryStats';
import { parseTreeRows, toGlobPattern } from '../utils/treeParser';

// Helpers

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const icons = {
    copy: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />',
    save: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />',
    editor: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm4 3h8M8 12h8M8 16h5" />',
    retry: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />',
    plus: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14" />',
    minus: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14" />',
    play: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z" />',
    success:
        '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
    warning:
        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
};

function getStatusIcon(type: string): string {
    switch (type) {
        case 'success':
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons.success}</svg>`;
        case 'error':
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons.error}</svg>`;
        case 'warning':
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons.warning}</svg>`;
        default:
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons.info}</svg>`;
    }
}

// Components

function Button({ onClick, variant = 'primary', icon, children, attrs = {} }: ButtonProps): string {
    const variantClasses = { primary: 'primary-button', danger: 'danger-button' };
    const attrString = Object.entries(attrs)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
    const attrPrefix = attrString ? ` ${attrString}` : '';
    return `<button class="button ${variantClasses[variant]}" onclick="${onClick}"${attrPrefix}>${icon ? `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icon}</svg>` : ''}${children}</button>`;
}

function Section({
    title,
    content,
    copyButton = true,
    copyFunction,
    id,
    raw,
    body,
}: SectionProps): string {
    const idAttr = id ? ` id="${id}"` : '';
    const rawAttr = raw !== undefined ? ` data-raw="${escapeHtml(raw)}"` : '';
    const innerBody = body ?? `<pre>${content}</pre>`;
    return `<div><div class="section-header"><h3 class="section-title">${title}</h3>${copyButton ? `<button type="button" class="primary-button" onclick="${copyFunction || ''}"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icons.copy}</svg>Copy</button>` : ''}</div><div class="section-shadow-wrapper"><div class="content-box"><div class="scrollable-content"${idAttr}${rawAttr}>${innerBody}</div></div></div></div>`;
}

/**
 * Render the directory tree as rows that can be turned into filters. Each entry
 * carries the glob it maps to, so clicking + / - only edits the pattern inputs;
 * the digest is re-run when the user presses Re-Ingest.
 */
function TreeView(tree: string): string {
    const rows = parseTreeRows(tree);
    const hasEntries = rows.some((row) => typeof row.path === 'string' && row.path !== '');
    if (!hasEntries) {
        return `<pre>${escapeHtml(tree)}</pre>`;
    }

    const lines = rows
        .map((row) => {
            const text = `<span class="tree-text">${escapeHtml(row.text)}</span>`;
            if (!row.path) {
                return `<div class="tree-line">${text}</div>`;
            }

            const pattern = escapeHtml(toGlobPattern(row.path, row.isDirectory));
            const label = escapeHtml(row.path);
            return `<div class="tree-line tree-entry">${text}<span class="tree-actions">${TreeAction('include', pattern, label)}${TreeAction('exclude', pattern, label)}</span></div>`;
        })
        .join('');

    return `<div class="tree">${lines}</div>`;
}

function TreeAction(target: 'include' | 'exclude', pattern: string, label: string): string {
    const verb = target === 'include' ? 'Include' : 'Exclude';
    const icon = target === 'include' ? icons.plus : icons.minus;
    return `<button type="button" class="tree-action tree-action-${target}" title="${verb} ${label}" aria-label="${verb} ${label}" data-target="${target}" data-pattern="${pattern}" onclick="addPattern(this)"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icon}</svg></button>`;
}

/** Headline facts from the summary, rendered as chips above the results. */
function StatChips(summary: string): string {
    const stats = parseSummaryStats(summary);
    if (stats.length === 0) {
        return '';
    }

    const chips = stats
        .map(
            (stat) =>
                `<span class="stat-chip"><span class="stat-label">${escapeHtml(stat.label)}</span><span class="stat-value">${escapeHtml(stat.value)}</span></span>`,
        )
        .join('');
    return `<div class="stat-chips">${chips}</div>`;
}

function FilterPanel(ingestedPath: string, filters: ResultFilters): string {
    const toText = (patterns: string[]): string => escapeHtml(patterns.join('\n'));
    const toKb = (bytes: number): number => Math.max(1, Math.round(bytes / 1024));

    return `<div class="filter-panel" id="gi-filters" data-path="${escapeHtml(ingestedPath)}" data-default-include="${toText(filters.defaults.includePatterns)}" data-default-exclude="${toText(filters.defaults.excludePatterns)}" data-default-maxsize="${toKb(filters.defaults.maxFileSize)}">
        <div class="filter-grid">
            <div class="filter-field"><label class="filter-label" for="gi-include">Include patterns</label><textarea id="gi-include" class="filter-input" rows="2" spellcheck="false" placeholder="src/**, **/*.ts">${toText(filters.applied.includePatterns)}</textarea></div>
            <div class="filter-field"><label class="filter-label" for="gi-exclude">Exclude patterns</label><textarea id="gi-exclude" class="filter-input" rows="2" spellcheck="false" placeholder="**/node_modules, **/*.min.js">${toText(filters.applied.excludePatterns)}</textarea></div>
            <div class="filter-field filter-field-small"><label class="filter-label" for="gi-maxsize">Max file size (KB)</label><input id="gi-maxsize" class="filter-input" type="number" min="1" step="1" value="${toKb(filters.applied.maxFileSize)}"></div>
        </div>
        <div class="filter-actions">${Button({ onClick: 'reIngest()', icon: icons.retry, children: 'Re-Ingest' })}<button type="button" class="link-button" onclick="resetFilters()">Reset to settings</button><span class="filter-hint">One pattern per line or comma separated. Use + / - on a tree entry to add it here.</span></div>
    </div>`;
}

// Styles

const getBaseStyles = (theme: ThemeColors = THEME) => `
:root {
  --gi-page-bg: var(--vscode-editor-background, #FFFDF8);
  --gi-card-bg: var(--vscode-editorWidget-background, #fafafa);
  --gi-surface: var(--vscode-editorHoverWidget-background, #fff4da);
  --gi-fg: var(--vscode-editor-foreground, #1a1a1a);
  --gi-border: var(--vscode-contrastBorder, var(--vscode-panel-border, #1a1a1a));
  --gi-shadow: var(--vscode-widget-shadow, #1a1a1a);
  --gi-accent: var(--vscode-button-background, #ffc480);
  --gi-accent-fg: var(--vscode-button-foreground, #1a1a1a);
  --gi-input-bg: var(--vscode-input-background, #fffdf8);
  --gi-input-fg: var(--vscode-input-foreground, #1a1a1a);
  --gi-hover: var(--vscode-list-hoverBackground, rgba(127, 127, 127, 0.15));
  --gi-danger: var(--vscode-errorForeground, ${theme.danger});
  --gi-success: var(--vscode-testing-iconPassed, #27ae60);
  --gi-warning: var(--vscode-editorWarning-foreground, #f39c12);
  --gi-info: var(--vscode-textLink-foreground, ${theme.primary});
}
body {font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif);padding: 20px;color: var(--gi-fg);line-height: 1.6;background-color: var(--gi-page-bg);}.shadow-wrapper {position: relative;}.shadow-wrapper::before {content: '';position: absolute;inset: 0;background: var(--gi-shadow);border-radius: 12px;transform: translate(2px, 2px);z-index: 10;}.content-wrapper {background: var(--gi-card-bg);border: 3px solid var(--gi-border);border-radius: 12px;padding: 24px;position: relative;z-index: 20;}.loading-container {display: flex;justify-content: center;align-items: center;min-height: 400px;}.loading-content {width: 100%;max-width: 500px;text-align: center;}.loader-wrapper {margin-bottom: 2rem;}.loading-title {font-size: 1.5rem;font-weight: 600;margin: 1rem 0;color: var(--gi-fg);}.loader {border: 4px solid var(--gi-surface);border-top: 4px solid var(--gi-accent);border-radius: 50%;width: 60px;height: 60px;animation: spin 1s linear infinite;margin: 0 auto;}.status-container {margin: 2rem 0;}.status-item {display: flex;align-items: center;justify-content: center;gap: 0.75rem;padding: 0.75rem;margin-bottom: 0.75rem;border-radius: 8px;background: var(--gi-surface);border: 2px solid var(--gi-border);font-size: 1rem;transition: transform 0.2s ease;}.status-item:hover {transform: translateY(-1px);}.status-item.success {color: var(--gi-success);}.status-item.error {color: var(--gi-danger);}.status-item.warning {color: var(--gi-warning);}.status-item.info {color: var(--gi-info);}.status-icon {display: flex;align-items: center;}.status-text {font-weight: 500;}@keyframes spin {0% {transform: rotate(0deg);}100% {transform: rotate(360deg);}}.inner-content {background: var(--gi-surface);border: 3px solid var(--gi-border);border-radius: 12px;padding: 24px;position: relative;}.grid {display: grid;grid-template-columns: 1fr 1fr;gap: 24px;margin-bottom: 24px;}@media (max-width: 768px) {.grid {grid-template-columns: 1fr;}}.section-title {font-size: 1.25rem;font-weight: bold;color: var(--gi-fg);margin-bottom: 16px;}.section-header {display: flex;justify-content: space-between;align-items: center;margin-bottom: 16px;}button {padding: 12px 24px;cursor: pointer;border-radius: 8px;font-weight: 600;font-size: 1rem;transition: all 0.2s;position: relative;z-index: 20;display: inline-flex;align-items: center;gap: 0.5rem;}.primary-button {background-color: var(--gi-accent);color: var(--gi-accent-fg);border: 3px solid var(--gi-border);}.primary-button:hover {transform: translate(-1px, -1px);}.danger-button {background-color: var(--gi-danger);color: white;border: 3px solid var(--gi-border);}.danger-button:hover {transform: translate(-1px, -1px);}.button-group {display: flex;gap: 12px;margin-top: 16px;}.section-shadow-wrapper {position: relative;margin-bottom: 16px;}.section-shadow-wrapper::before {content: '';position: absolute;inset: 0;background: var(--gi-shadow);border-radius: 8px;transform: translate(2px, 2px);z-index: 10;}.content-box {background: var(--gi-surface);border: 3px solid var(--gi-border);border-radius: 8px;padding: 16px;position: relative;z-index: 20;display: flex;flex-direction: column;height: 100%;}textarea, pre {font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);font-size: 0.875rem;line-height: 1.5;padding: 12px;background: var(--gi-surface);border: 3px solid var(--gi-border);border-radius: 4px;width: 100%;min-height: 150px;resize: vertical;white-space: pre-wrap;word-wrap: break-word;margin: 0;}.scrollable-content {position: relative;max-height: 300px;overflow-y: auto;overflow-x: hidden;border: 3px solid var(--gi-border);border-radius: 4px;background: var(--gi-surface);}.scrollable-content pre {border: none;margin: 0;height: 100%;}.error-container {display: flex;justify-content: center;align-items: center;min-height: 400px;}.error-content {width: 100%;max-width: 500px;text-align: center;}.error-icon {color: var(--gi-danger);margin-bottom: 1.5rem;}.error-title {font-size: 1.75rem;font-weight: 600;color: var(--gi-danger);margin-bottom: 1.5rem;}.error-messages {margin: 2rem 0;}.error-message {display: flex;align-items: center;justify-content: center;gap: 0.75rem;padding: 0.75rem;margin-bottom: 0.75rem;border-radius: 8px;background: var(--gi-surface);border: 2px solid var(--gi-border);font-size: 1rem;transition: transform 0.2s ease;}.error-message:hover {transform: translateY(-1px);}.error-message-icon {display: flex;align-items: center;color: var(--gi-danger);}.error-message-text {font-weight: 500;color: var(--gi-fg);}.error-actions {display: flex;gap: 1rem;justify-content: center;margin-top: 2rem;}.stat-chips {display: flex;flex-wrap: wrap;gap: 12px;margin-bottom: 24px;}.stat-chip {display: inline-flex;align-items: baseline;gap: 8px;padding: 6px 12px;border: 3px solid var(--gi-border);border-radius: 999px;background: var(--gi-surface);font-size: 0.85rem;}.stat-label {text-transform: uppercase;letter-spacing: 0.03em;font-size: 0.7rem;opacity: 0.75;}.stat-value {font-weight: 700;}.filter-panel {background: var(--gi-surface);border: 3px solid var(--gi-border);border-radius: 12px;padding: 16px;margin-bottom: 24px;}.filter-grid {display: grid;grid-template-columns: 1fr 1fr 160px;gap: 16px;}@media (max-width: 768px) {.filter-grid {grid-template-columns: 1fr;}}.filter-field {display: flex;flex-direction: column;gap: 6px;min-width: 0;}.filter-label {font-size: 0.8rem;font-weight: 700;text-transform: uppercase;letter-spacing: 0.03em;color: var(--gi-fg);}.filter-input {font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);font-size: 0.85rem;padding: 8px;border: 3px solid var(--gi-border);border-radius: 8px;background: var(--gi-input-bg);color: var(--gi-input-fg);width: 100%;min-height: auto;resize: vertical;}.filter-actions {display: flex;align-items: center;flex-wrap: wrap;gap: 12px;margin-top: 16px;}.filter-hint {font-size: 0.8rem;opacity: 0.75;margin: 0;}.link-button {background: none;border: none;padding: 0;font-size: 0.85rem;font-weight: 600;text-decoration: underline;color: inherit;}.tree {font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);font-size: 0.875rem;line-height: 1.5;padding: 12px;}.tree-line {display: flex;align-items: center;justify-content: space-between;gap: 8px;border-radius: 4px;padding: 0 4px;white-space: pre;}.tree-entry:hover {background: var(--gi-hover);}.tree-text {white-space: pre;overflow: hidden;text-overflow: ellipsis;}.tree-actions {display: flex;gap: 4px;opacity: 0;flex-shrink: 0;}.tree-entry:hover .tree-actions, .tree-entry:focus-within .tree-actions {opacity: 1;}.tree-action {padding: 2px;border: 2px solid var(--gi-border);border-radius: 4px;background: var(--gi-input-bg);color: var(--gi-input-fg);line-height: 0;}.tree-action-added {background: var(--gi-accent);color: var(--gi-accent-fg);}
`;

// Templates

export function getErrorContent(title: string, messages: string[]): string {
    const content = `<div class="shadow-wrapper"><div class="content-wrapper"><div class="error-container"><div class="error-content"><div class="error-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div><h2 class="error-title">${title}</h2><div class="error-messages">${messages.map((msg) => `<div class="error-message"><span class="error-message-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></span><span class="error-message-text">${msg}</span></div>`).join('')}</div><div class="error-actions">${Button({ onClick: 'retryAnalysis()', variant: 'primary', children: 'Retry Analysis', icon: icons.retry })}</div></div></div></div></div><script>function retryAnalysis(){vscode.postMessage({command:'retry'})}</script>`;
    return createHtmlDocument(content, getBaseStyles(THEME));
}

export function getLoadingContent(statusMessages: StatusMessage[]): string {
    const content = `<div class="shadow-wrapper"><div class="content-wrapper"><div class="loading-container"><div class="loading-content"><div class="loader-wrapper"><div class="loader"></div><h2 class="loading-title">Analyzing Repository</h2></div><div class="status-container">${statusMessages.map((msg) => `<div class="status-item ${msg.type}"><span class="status-icon">${getStatusIcon(msg.type)}</span><span class="status-text">${msg.text}</span></div>`).join('')}</div>${Button({ onClick: 'cancelAnalysis()', variant: 'danger', children: 'Cancel Analysis' })}</div></div></div></div><script>function cancelAnalysis(){vscode.postMessage({command:'cancel'})}</script>`;
    return createHtmlDocument(content, getBaseStyles(THEME));
}

export function getResultsContent(
    data: AnalysisResultData,
    ingestedPath?: string,
    filters?: ResultFilters,
): string {
    const ingestedPathTrimmed = ingestedPath?.trim() ?? '';
    const filterPanel =
        ingestedPathTrimmed && filters ? FilterPanel(ingestedPathTrimmed, filters) : '';
    const reIngestButton =
        ingestedPathTrimmed && !filterPanel
            ? Button({ onClick: 'reIngest()', icon: icons.retry, children: 'Re-Ingest' })
            : '';
    const buttonGroup = `<div class="button-group">${Button({ onClick: 'copyAll()', icon: icons.copy, children: 'Copy All' })}${Button({ onClick: 'saveToFile()', icon: icons.save, children: 'Save to File' })}${Button({ onClick: 'openInEditor()', icon: icons.editor, children: 'Open in Editor' })}${reIngestButton}</div>`;

    const summarySection = Section({
        title: 'Summary',
        content: escapeHtml(data.summary),
        copyFunction: 'copySummary()',
        id: 'gi-summary',
        raw: data.summary,
    });
    const treeSection = Section({
        title: 'Directory Structure',
        content: escapeHtml(data.tree),
        copyFunction: 'copyTree()',
        id: 'gi-tree',
        raw: data.tree,
        body: TreeView(data.tree),
    });
    const contentSection = Section({
        title: 'Files Content',
        content: escapeHtml(data.content),
        copyFunction: 'copyContent()',
        id: 'gi-content',
        raw: data.content,
    });

    const content = `<div class="shadow-wrapper"><div class="content-wrapper">${filterPanel}${StatChips(data.summary)}<div class="grid"><div>${summarySection}${buttonGroup}</div>${treeSection}</div>${contentSection}</div></div><script>${resultsScript(ingestedPathTrimmed)}</script>`;
    return createHtmlDocument(content, getBaseStyles(THEME));
}

function resultsScript(ingestedPath: string): string {
    return `
const fallbackPath = ${JSON.stringify(ingestedPath)};
function raw(id) { const el = document.getElementById(id); if (!el) { return ''; } const value = el.getAttribute('data-raw'); return value === null ? el.innerText : value; }
function splitPatterns(value) { return (value || '').split(/[\\n,]/).map(function (part) { return part.trim(); }).filter(Boolean); }
function fieldValue(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function currentOptions() {
    const kb = Number(fieldValue('gi-maxsize'));
    const options = { includePatterns: splitPatterns(fieldValue('gi-include')), excludePatterns: splitPatterns(fieldValue('gi-exclude')) };
    if (Number.isFinite(kb) && kb > 0) { options.maxFileSize = Math.round(kb * 1024); }
    return options;
}
function addPattern(button) {
    const target = button.getAttribute('data-target');
    const pattern = button.getAttribute('data-pattern');
    const field = document.getElementById(target === 'include' ? 'gi-include' : 'gi-exclude');
    if (!pattern || !field) { return; }
    const patterns = splitPatterns(field.value);
    if (patterns.indexOf(pattern) === -1) { patterns.push(pattern); }
    field.value = patterns.join('\\n');
    button.classList.add('tree-action-added');
    setTimeout(function () { button.classList.remove('tree-action-added'); }, 600);
}
function resetFilters() {
    const panel = document.getElementById('gi-filters');
    if (!panel) { return; }
    document.getElementById('gi-include').value = panel.getAttribute('data-default-include') || '';
    document.getElementById('gi-exclude').value = panel.getAttribute('data-default-exclude') || '';
    document.getElementById('gi-maxsize').value = panel.getAttribute('data-default-maxsize') || '';
}
function reIngest() {
    const panel = document.getElementById('gi-filters');
    const path = panel ? panel.getAttribute('data-path') : fallbackPath;
    if (!path) { return; }
    vscode.postMessage({ command: 'reIngest', path: path, options: panel ? currentOptions() : undefined });
}
function copySummary() { vscode.postMessage({ command: 'copy', text: raw('gi-summary') }); }
function copyTree() { vscode.postMessage({ command: 'copy', text: raw('gi-tree') }); }
function copyContent() { vscode.postMessage({ command: 'copy', text: raw('gi-content') }); }
function copyAll() { vscode.postMessage({ command: 'copy', text: [raw('gi-summary'), raw('gi-tree'), raw('gi-content')].join('\\n\\n') }); }
function digest() { return { summary: raw('gi-summary'), tree: raw('gi-tree'), content: raw('gi-content') }; }
function saveToFile() { vscode.postMessage({ command: 'saveToFile', data: digest() }); }
function openInEditor() { vscode.postMessage({ command: 'openInEditor', data: digest() }); }
`;
}

// Utils

function createHtmlDocument(content: string, styles: string): string {
    return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';"><style>${styles}</style><script>const vscode = acquireVsCodeApi();</script></head><body>${content}</body></html>`;
}
