import {AnkiConnectClient} from './ankiconnect';
import {fetchAsBase64} from './media';
import {buildAudioUrl, buildImageUrl, findMatchingExample, searchExamples} from '../shared/immersionkit';
import {loadSettings, saveSettings} from '../shared/settings';
import type {MiningPayload, MiningResult, RuntimeMessage} from '../shared/types';

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  void handleMessage(message).then(sendResponse).catch((error: unknown) => {
    const miningResult: MiningResult = {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown extension error'
    };
    sendResponse(miningResult);
  });

  return true;
});

async function handleMessage(message: RuntimeMessage): Promise<MiningResult | object> {
  switch (message.type) {
    case 'get-settings':
      return loadSettings();
    case 'save-settings':
      await saveSettings(message.payload);
      return {ok: true};
    case 'mine-example':
      return mineExample(message.payload);
    default:
      throw new Error('Unsupported message');
  }
}

async function mineExample(payload: MiningPayload): Promise<MiningResult> {
  const settings = await loadSettings();
  const anki = new AnkiConnectClient(settings.ankiConnectUrl);

  await anki.version();

  const examples = await searchExamples(payload.search);
  const example = findMatchingExample(examples, payload.sentence);
  if (!example) {
    throw new Error('Could not match the clicked example against the Immersion Kit search results');
  }

  const imageUrl = buildImageUrl(example);
  const audioUrl = buildAudioUrl(example);

  const noteId = await findLatestNoteId(anki, settings.latestNoteQuery);

  const fields: Record<string, string> = {
    [settings.sentenceField]: escapeHtml(example.sentence)
  };
  const updatedFields = [settings.sentenceField];

  if (imageUrl) {
    const imageData = await fetchAsBase64(imageUrl);
    const storedImageName = await anki.storeMediaFile(`${example.id}.jpg`, imageData);
    if (storedImageName) {
      fields[settings.imageField] = `<img src="${storedImageName}">`;
      updatedFields.push(settings.imageField);
    }
  }

  if (audioUrl) {
    const audioData = await fetchAsBase64(audioUrl);
    const storedAudioName = await anki.storeMediaFile(`${example.id}.mp3`, audioData);
    if (storedAudioName) {
      fields[settings.audioField] = `[sound:${storedAudioName}]`;
      updatedFields.push(settings.audioField);
    }
  }

  await anki.updateNoteFields(noteId, fields);

  return {
    ok: true,
    noteId,
    updatedFields
  };
}

async function findLatestNoteId(anki: AnkiConnectClient, query: string): Promise<number> {
  const noteIds = await anki.findNotes(query);
  if (noteIds.length === 0) {
    throw new Error(`No Anki notes matched query "${query}"`);
  }

  const notes = await anki.notesInfo(noteIds);
  const latest = notes.reduce<NoteInfoLike | null>((currentLatest, note) => {
    if (!currentLatest || note.noteId > currentLatest.noteId) {
      return note;
    }
    return currentLatest;
  }, null);

  if (!latest) {
    throw new Error('Could not determine the latest Anki note');
  }

  return latest.noteId;
}

type NoteInfoLike = {
  noteId: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
