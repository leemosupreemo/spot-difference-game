// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { Share } from '@capacitor/share';
import { Filesystem } from '@capacitor/filesystem';
import { shareNativeResult } from './nativeShare.js';
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }));
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: { writeFile: vi.fn(), deleteFile: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  Share.share.mockResolvedValue({ activityType: 'Messages' });
  Filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/result.png' });
  Filesystem.deleteFile.mockResolvedValue(undefined);
});
test('native image share attaches a real cached file and cleans up after sharing', async () => {
  const result = await shareNativeResult({ title: 'Result', text: 'Top 45%', url: 'https://diffhunter.web.app', cardBlob: new Blob(['image'], { type: 'image/png' }) });
  expect(result.success).toBe(true);
  expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({ text: 'Top 45%', url: 'https://diffhunter.web.app', files: ['file:///cache/result.png'] }));
  expect(Filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({ data: 'aW1hZ2U=', directory: 'CACHE' }));
  expect(Filesystem.deleteFile).toHaveBeenCalledWith(expect.objectContaining({ directory: 'CACHE' }));
});
test('native cancellation is not reported as a successful share', async () => {
  Share.share.mockRejectedValue(new Error('Share canceled'));
  expect(await shareNativeResult({ text: 'Result' })).toMatchObject({ success: false, cancelled: true });
});
test('native failures propagate so the sheet can offer a link fallback', async () => {
  Share.share.mockRejectedValue(new Error('Sharing unavailable'));
  await expect(shareNativeResult({ text: 'Result' })).rejects.toThrow('Sharing unavailable');
});
