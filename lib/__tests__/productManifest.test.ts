import { describe, expect, it } from 'vitest';

import manifest from '../../product.json';

describe('public product manifest', () => {
	it('keeps the CareQuest metadata contract consumable by VEAI.jp', () => {
		expect(manifest).toMatchObject({
			schemaVersion: 1,
			slug: 'carequest',
			name: 'CareQuest',
			portfolioRole: 'daily-care-recording',
			evidenceLevel: 'implemented',
			canonicalRepository: 'https://github.com/larai-w/carequest',
			availability: {
				stage: 'public-mvp',
				access: 'public',
				liveUrl: 'https://veai.jp/carequest/',
			},
			publicUrls: {
				productPage: 'https://veai.jp/apps/carequest/',
				project: 'https://github.com/users/larai-w/projects/7',
				app: 'https://veai.jp/carequest/',
			},
			site: {
				status: 'released',
				liveUrl: 'https://veai.jp/carequest/',
			},
		});
		expect(manifest.$schema).toMatch(/^https:\/\//);
		expect(manifest.capabilities).not.toHaveLength(0);
		expect(manifest.boundaries.en).not.toHaveLength(0);
		expect(manifest.boundaries.ja).not.toHaveLength(0);
	});
});
