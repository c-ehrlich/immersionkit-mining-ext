# Immersion Kit Mining Extension Plan

## Goal

Build a Chrome extension in TypeScript that adds one custom button to each Immersion Kit example card on the dictionary page and updates the most recently created Anki note with:

- sentence
- image
- audio

The target Anki field names should be user-configurable.

## Scope

### In scope

- Inject one button per example result on `immersionkit.com/dictionary`
- Extract sentence text from the current example
- Extract or derive the resolved image/audio URLs for the current example
- Download media in the extension background context
- Upload media to Anki via AnkiConnect
- Find the newest Anki note and update configured fields
- Persist extension settings locally

### Out of scope for v1

- Creating new notes
- Editing multiple notes at once
- Full settings UI polish
- Supporting every Immersion Kit page outside the dictionary
- Supporting browsers other than Chrome

## Current feasibility summary

- Button injection is practical: the page is normal React DOM, not Shadow DOM or canvas.
- The page lazy-loads examples and supports multiple layouts, so injection must be observer-based and idempotent.
- The site search API returns the sentence data and media filenames, but not always the final media URLs directly.
- The site itself computes `image_url` and `sound_url` client-side and exposes a built-in "Mining" tab per example.
- Anki integration is straightforward if we follow the Yomitan pattern:
  1. fetch media
  2. base64-encode media
  3. `storeMediaFile`
  4. `updateNoteFields`

## Recommended architecture

### Stack

- TypeScript everywhere
- React + TSX only where UI is useful
- Tailwind optional; not required for v1
- Build tool: Vite
- Chrome extension target: Manifest V3

### Why this stack

- Vite keeps TS + MV3 iteration simple
- React is useful for a settings page or injected button root if needed
- Tailwind is optional because the injected UI can stay minimal
- Most complexity is in content/background messaging, not UI styling

## Extension structure

```text
src/
  background/
    index.ts
    ankiconnect.ts
    media.ts
    immersionkit.ts
    settings.ts
  content/
    index.ts
    observer.ts
    anchors.ts
    extract.ts
    button.tsx
  options/
    index.html
    main.tsx
    App.tsx
  shared/
    types.ts
    messaging.ts
    constants.ts
manifest.config.ts or manifest.json
```

## Runtime design

### 1. Content script responsibilities

- Run only on `https://www.immersionkit.com/dictionary*`
- Watch for example cards appearing, disappearing, and re-rendering
- Inject one extension button per example card
- Keep injection idempotent with a marker attribute like `data-mining-ext-initialized`
- On click:
  - locate the current example container
  - extract sentence text
  - get resolved image/audio URL if already present in DOM
  - if not present, collect enough metadata to let the background rebuild the media URL
  - send a message to the background worker

### 2. Background service worker responsibilities

- Receive extraction payload from content script
- Fetch image/audio in extension context
- Convert binaries to base64 for AnkiConnect
- Find the newest note in Anki
- Upload media with `storeMediaFile`
- Update configured note fields with `updateNoteFields`
- Return success/error state to the content script

### 3. Options page responsibilities

- Let the user define:
  - AnkiConnect URL or port
  - sentence field name
  - image field name
  - audio field name
  - optional note filter if "latest note" needs narrowing later
- Save settings in `chrome.storage.sync` or `chrome.storage.local`

## Injection strategy

### Primary strategy

Use a `MutationObserver` rooted near the dictionary results area.

Implementation rules:

- Never inject by brittle hashed class names
- Prefer stable structural anchors:
  - existing example cards
  - nearby buttons/tabs
  - repeated sentence container patterns
- Use event delegation where possible
- Re-run a lightweight scan after:
  - route param changes
  - infinite scroll appends
  - list/block layout toggles

### Practical anchor choice

Best first target:

- inject next to the site's existing per-example controls, especially near the built-in `Mining` / `Download` tab region if present

Fallback:

- inject into the example card header/body wrapper once per card

### Idempotency rule

Every card gets:

- a stable marker attribute
- one mounted button root only

This avoids duplicate buttons during React re-renders.

## Extraction strategy

### Sentence

Use DOM text extraction from the current example card.

Preferred value:

- plain sentence text, not furigana markup

### Image and audio

Use this order:

1. Read already-resolved `img.src` / audio source URLs from the DOM if the site has rendered them.
2. If only filename metadata is available, reconstruct the media URL from:
   - example `id`
   - media filename
   - title slug to title-path mapping
3. If reconstruction proves brittle, trigger/open the site's mining pane and read the resolved URLs from there.

### Important note

API-only extraction is possible, but not the best v1 path. The search API returns media filenames and a title slug, while the final object path depends on the site's title mapping. Reading the resolved URL from the page is less fragile for v1.

## Immersion Kit integration details

### Search data source

The site uses:

- `https://apiv2.immersionkit.com/search?q=...`

The response includes:

- `examples`
- `dictionary_entries`
- `locale`
- `category_count`
- `deck_count`

An example item includes:

- `id`
- `sentence`
- `sentence_with_furigana`
- `translation`
- `image`
- `sound`
- `title`
- `word_list`
- `matched_indexes`

### Media URL note

The site computes final media URLs client-side. For v1, do not hard-code assumptions until DOM extraction is tested against real rendered examples.

## Anki strategy

### Recommended flow

1. Fetch newest note id
2. Download media
3. `storeMediaFile` for image
4. `storeMediaFile` for audio
5. `updateNoteFields` on newest note

### Why not use `guiAddCards`

- It creates a new note
- Your requirement is to update the latest existing note
- Yomitan's media flow maps more cleanly to this use case

### Newest note lookup

Candidate v1 approach:

- call `findNotes` with a broad query like `added:1`
- call `notesInfo`
- choose the highest note id

If that is too broad in practice, add an optional config filter later:

- deck name
- model name
- search query

## Data model

```ts
type ExtensionSettings = {
  ankiConnectUrl: string;
  sentenceField: string;
  imageField: string;
  audioField: string;
  latestNoteQuery?: string;
};

type ExamplePayload = {
  sentence: string;
  imageUrl?: string;
  audioUrl?: string;
  imageMeta?: {
    id: string;
    fileName: string;
    titleSlug?: string;
  };
  audioMeta?: {
    id: string;
    fileName: string;
    titleSlug?: string;
  };
};
```

## Messaging flow

```text
content script
  -> extract example payload
  -> send message to background

background
  -> load settings
  -> resolve media URLs if needed
  -> fetch binaries
  -> storeMediaFile(image/audio)
  -> find newest note
  -> updateNoteFields
  -> send result back

content script
  -> show success/error state on the button
```

## UI plan

### Injected button

Minimal v1 UI:

- one small button
- idle state
- loading state
- success state
- error state

This can be:

- plain DOM + CSS, or
- a tiny React mount

Recommendation:

- start with plain DOM or a tiny TSX mount
- skip Tailwind for the injected button unless a settings page already uses it

### Options page

Use React + TSX here. This is where UI tooling is actually worth it.

Fields:

- AnkiConnect URL
- Sentence field
- Image field
- Audio field
- optional newest-note query override

## Build plan

### Phase 1: Scaffold

- Set up Vite + TypeScript + MV3
- Create manifest
- Add content script, background worker, and options page entries
- Add storage wrapper and message types

### Phase 2: Injection

- Implement result observer
- Identify example card anchors
- Inject one button per card
- Prevent duplicate mounts

### Phase 3: Extraction

- Extract sentence text reliably
- Prefer resolved DOM media URLs
- Add fallback media URL reconstruction if needed

### Phase 4: Anki

- Implement AnkiConnect client
- Implement newest note lookup
- Implement media upload + field update

### Phase 5: UX and hardening

- Add loading/success/error states
- Add retry-safe behavior
- Improve logs
- Test against infinite scroll and layout changes

## Risk register

### Risk 1: DOM anchors change

Mitigation:

- avoid hashed class names
- centralize anchor logic in one module
- prefer structural matching and visible labels

### Risk 2: Media URL reconstruction is brittle

Mitigation:

- prefer reading resolved URLs from rendered DOM
- keep reconstruction as fallback only

### Risk 3: "Newest note" is ambiguous

Mitigation:

- make the query configurable
- start with highest note id

### Risk 4: CORS or fetch restrictions

Mitigation:

- fetch media from the extension background worker
- request explicit host permissions

## Manifest notes

Likely permissions:

- `storage`
- host permissions for:
  - `https://www.immersionkit.com/*`
  - `https://apiv2.immersionkit.com/*`
  - `https://us-southeast-1.linodeobjects.com/*`
  - `http://127.0.0.1/*`

Likely extension parts:

- background service worker
- content script on Immersion Kit dictionary pages
- options page

## Testing plan

### Manual tests

- button appears once per example card
- button appears on newly lazy-loaded cards
- button still works after layout toggle
- sentence/image/audio reach the intended Anki fields
- failures show useful feedback

### Edge cases

- no newest note found
- note missing configured fields
- missing image
- missing audio
- Anki closed
- AnkiConnect disabled

## Recommended first implementation order

1. Scaffold MV3 + TS project
2. Hard-code one button on one example row
3. Extract sentence text only
4. Wire newest-note update for sentence only
5. Add media fetching and `storeMediaFile`
6. Add settings page
7. Harden observer + selectors

## Decision summary

- Use TypeScript everywhere
- Use React only where it helps, especially the options page
- Keep the injected button minimal
- Use DOM-observer-based injection
- Prefer DOM-resolved media URLs over API-only reconstruction
- Use Yomitan-style `storeMediaFile` + `updateNoteFields`
