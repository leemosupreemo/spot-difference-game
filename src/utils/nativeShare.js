import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';

export const isNativeSharing = () => Capacitor.isNativePlatform();

export async function shareNativeResult({ title, text, url, cardBlob }) {
  let path;
  try {
    const options = { title, text, url, dialogTitle: 'Share result' };
    if (cardBlob) {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(cardBlob);
      });
      path = `diff-hunter-result-${Date.now()}.png`;
      const file = await Filesystem.writeFile({ path, directory: Directory.Cache, data });
      options.files = [file.uri];
    }
    await Share.share(options);
    return { success: true, message: 'Shared successfully.' };
  } catch (error) {
    if (error?.name === 'AbortError' || /cancel/i.test(error?.message || '')) {
      return { success: false, cancelled: true, message: 'Share cancelled.' };
    }
    throw error;
  } finally {
    if (path) await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
  }
}
