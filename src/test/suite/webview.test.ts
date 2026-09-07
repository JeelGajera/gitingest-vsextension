import * as assert from 'assert';
import { DEFAULT_MAX_FILE_SIZE } from '../../config';
import { ResultFilters } from '../../types';
import { getResultsContent } from '../../webview';

const data = {
    summary: 'Files analyzed: 3',
    tree: ['Directory structure:', '└── repo/', '    └── src/', '        └── a.ts'].join('\n'),
    content: 'FILE: src/a.ts\nexport const a = 1;',
};

const filters: ResultFilters = {
    applied: {
        includePatterns: ['src/**'],
        excludePatterns: ['**/node_modules'],
        maxFileSize: 51200,
    },
    defaults: {
        includePatterns: [],
        excludePatterns: ['**/node_modules', '**/.git'],
        maxFileSize: DEFAULT_MAX_FILE_SIZE,
    },
};

describe('webview results', () => {
    it('renders the filter panel with the applied options', () => {
        const html = getResultsContent(data, '/workspace/repo', filters);
        assert.ok(html.includes('id="gi-include"'));
        assert.ok(html.includes('id="gi-exclude"'));
        assert.ok(html.includes('>src/**</textarea>'));
        assert.ok(html.includes('value="50"'), 'max file size is shown in KB');
        assert.ok(html.includes('data-default-exclude="**/node_modules\n**/.git"'));
    });

    it('renders tree entries as include/exclude actions', () => {
        const html = getResultsContent(data, '/workspace/repo', filters);
        assert.ok(html.includes('data-pattern="src/**" onclick="addPattern(this)"'));
        assert.ok(html.includes('data-pattern="src/a.ts"'));
        assert.ok(html.includes('data-target="exclude"'));
    });

    it('omits the filter panel when no filters are provided', () => {
        const html = getResultsContent(data, '/workspace/repo');
        assert.ok(!html.includes('id="gi-filters"'));
        assert.ok(html.includes('Re-Ingest'), 'the plain re-ingest button still renders');
    });

    it('escapes analysis output', () => {
        const html = getResultsContent(
            { ...data, content: '<script>alert(1)</script>' },
            '/workspace/repo',
            filters,
        );
        assert.ok(!html.includes('<script>alert(1)</script>'));
        assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    });
});

describe('webview stat chips', () => {
    it('renders chips for the summary facts', () => {
        const html = getResultsContent(
            { ...data, summary: 'Directory: repo\nFiles analyzed: 3\nEstimated tokens: 1.2k' },
            '/workspace/repo',
            filters,
        );
        assert.ok(html.includes('class="stat-chips"'));
        assert.ok(html.includes('>Files analyzed</span><span class="stat-value">3</span>'));
    });

    it('omits the chips when the summary has no facts', () => {
        const html = getResultsContent(
            { ...data, summary: 'nothing structured here' },
            '/workspace/repo',
            filters,
        );
        assert.ok(!html.includes('class="stat-chips"'));
    });

    it('offers an open-in-editor action', () => {
        const html = getResultsContent(data, '/workspace/repo', filters);
        assert.ok(html.includes('openInEditor()'));
        assert.ok(html.includes("command: 'openInEditor'"));
    });
});
