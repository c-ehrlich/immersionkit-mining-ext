import { AnkiConnectClient } from "./ankiconnect";
import { canFetchMedia, fetchAsBase64 } from "./media";
import {
  buildAudioUrl,
  buildImageUrl,
  findMatchingExample,
  searchExamples,
} from "../shared/immersionkit";
import { appendDebugLog, clearDebugLog, loadDebugLog } from "../shared/debug";
import { loadSettings, saveSettings } from "../shared/settings";
import type {
  MiningPayload,
  MiningResult,
  RuntimeMessage,
} from "../shared/types";

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    void handleMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        const miningResult: MiningResult = {
          ok: false,
          error:
            error instanceof Error ? error.message : "Unknown extension error",
        };
        sendResponse(miningResult);
      });

    return true;
  },
);

async function handleMessage(
  message: RuntimeMessage,
): Promise<MiningResult | object> {
  switch (message.type) {
    case "get-settings":
      return loadSettings();
    case "save-settings":
      await saveSettings(message.payload);
      return { ok: true };
    case "get-debug-log":
      return loadDebugLog();
    case "clear-debug-log":
      await clearDebugLog();
      return { ok: true };
    case "mine-example":
      return mineExample(message.payload);
    default:
      throw new Error("Unsupported message");
  }
}

async function mineExample(payload: MiningPayload): Promise<MiningResult> {
  await appendDebugLog("background", "mineExample:start", payload);
  const settings = await loadSettings();
  const anki = new AnkiConnectClient(settings.ankiConnectUrl);

  await anki.version();

  const examples = await searchExamples(payload.search);
  const example = findMatchingExample(examples, payload);
  if (!example) {
    await appendDebugLog("background", "mineExample:no-match", {
      search: payload.search,
      sentence: payload.sentence,
      translation: payload.translation,
      title: payload.title,
    });
    throw new Error(
      "Could not match the clicked example against the ImmersionKit search results",
    );
  }

  await appendDebugLog("background", "mineExample:matched-example", {
    id: example.id,
    title: example.title,
    sentence: example.sentence,
    sound: example.sound,
    image: example.image,
  });

  const imageUrls = uniqueUrls([payload.imageUrl, buildImageUrl(example)]);
  const audioUrls = uniqueUrls([
    payload.audioUrl,
    deriveAudioUrlFromImageUrl(payload.imageUrl, example.sound),
    buildAudioUrl(example),
  ]);

  await appendDebugLog("background", "mineExample:media-candidates", {
    imageUrls,
    audioUrls,
  });

  const noteId = await findLatestNoteId(anki, settings.latestNoteQuery);

  const fields: Record<string, string> = {
    [settings.sentenceField]: escapeHtml(example.sentence),
  };
  const updatedFields = [settings.sentenceField];

  const imageUrl = await findWorkingMediaUrl(imageUrls, "image");
  await appendDebugLog("background", "mineExample:selected-image-url", {
    imageUrl,
  });
  if (imageUrl) {
    const imageData = await fetchAsBase64(imageUrl, "image");
    const storedImageName = await anki.storeMediaFile(
      `${example.id}.jpg`,
      imageData,
    );
    if (storedImageName) {
      fields[settings.imageField] = `<img src="${storedImageName}">`;
      updatedFields.push(settings.imageField);
    }
  }

  const audioUrl = await findWorkingMediaUrl(audioUrls, "audio");
  await appendDebugLog("background", "mineExample:selected-audio-url", {
    audioUrl,
  });
  if (audioUrl) {
    const audioData = await fetchAsBase64(audioUrl, "audio");
    const storedAudioName = await anki.storeMediaFile(
      `${example.id}.mp3`,
      audioData,
    );
    if (storedAudioName) {
      fields[settings.audioField] = `[sound:${storedAudioName}]`;
      updatedFields.push(settings.audioField);
    }
  }

  await anki.updateNoteFields(noteId, fields);
  await appendDebugLog("background", "mineExample:success", {
    noteId,
    updatedFields,
  });

  return {
    ok: true,
    noteId,
    updatedFields,
  };
}

async function findLatestNoteId(
  anki: AnkiConnectClient,
  query: string,
): Promise<number> {
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
    throw new Error("Could not determine the latest Anki note");
  }

  return latest.noteId;
}

type NoteInfoLike = {
  noteId: number;
};

async function findWorkingMediaUrl(
  urls: string[],
  mediaType: "image" | "audio",
): Promise<string | null> {
  for (const url of urls) {
    try {
      const ok = await canFetchMedia(url, mediaType);
      await appendDebugLog("background", "mineExample:probe-media-url", {
        mediaType,
        url,
        ok,
      });
      if (ok) {
        return url;
      }
    } catch (error) {
      await appendDebugLog("background", "mineExample:probe-media-url-error", {
        mediaType,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  return null;
}

function deriveAudioUrlFromImageUrl(
  imageUrl: string | undefined,
  soundFileName: string | undefined,
): string | null {
  if (!imageUrl || !soundFileName) {
    return null;
  }

  try {
    const url = new URL(imageUrl);

    if (url.pathname.includes("/media/")) {
      const parts = url.pathname.split("/");
      parts[parts.length - 1] = encodeURIComponent(soundFileName);
      url.pathname = parts.join("/");
      url.search = "";
      return url.toString();
    }

    if (url.pathname.includes("/download_media")) {
      const path = url.searchParams.get("path");
      if (!path) {
        return null;
      }

      const pathParts = path.split("/");
      pathParts[pathParts.length - 1] = soundFileName;
      url.searchParams.set("path", pathParts.join("/"));
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(urls.filter((value): value is string => Boolean(value))),
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
