import { describe, expect, it } from 'vitest';

import manifest from '../../product.json';

describe('public product manifest', () => {
	it('does not promise an unmeasured ten-second logging time in product descriptions', () => {
		for (const description of [manifest.site.en.description, manifest.site.ja.description]) {
			expect(description).not.toMatch(/(?:under|within|in|less than)\s+(?:10|ten)\s+seconds|10\s*秒(?:以内|で)/i);
		}
	});

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
