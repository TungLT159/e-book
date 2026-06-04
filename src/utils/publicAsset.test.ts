import { describe, expect, it } from 'vitest';
import { resolvePublicAssetPath } from './publicAsset';

describe('resolvePublicAssetPath', () => {
  it('keeps thumbnail assets under the active base url', () => {
    expect(resolvePublicAssetPath('/thumbnails/sample.png', '/reader/')).toBe(
      '/reader/thumbnails/sample.png',
    );
  });
});
