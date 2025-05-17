import * as FileSystem from 'expo-file-system';
import * as Intent from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function saveDocx(b64: string, filename: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: MIME });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href:url, download:filename }).click();
    URL.revokeObjectURL(url);
    return;
  }

  const uri = FileSystem.documentDirectory + '/' + filename;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType:MIME });
  } else {
    const cUri = await FileSystem.getContentUriAsync(uri);
    await Intent.startActivityAsync('android.intent.action.VIEW',
        { data:cUri, flags:1, type:MIME });
  }
}