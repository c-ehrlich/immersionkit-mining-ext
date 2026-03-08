import type {MiningPayload, MiningResult, RuntimeMessage, SearchContext} from '../shared/types';

const BUTTON_ATTR = 'data-mining-ext-button';
const STATUS_ATTR = 'data-mining-ext-status';
const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9faf]/;
const LATIN_RE = /[A-Za-z]/;
const CONTROL_TEXT_RE = /^(Mining|Download|Image|Sound|Translation|Sentence|Sentence with Furigana)$/i;
let scanScheduled = false;

observePage();
scheduleScan();

function observePage(): void {
  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener(
    'scroll',
    () => {
      scheduleScan();
    },
    {passive: true}
  );

  window.addEventListener('load', () => {
    scheduleScan();
  });
}

function scheduleScan(): void {
  if (scanScheduled) {
    return;
  }

  scanScheduled = true;
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      scanScheduled = false;
      scanForTargets();
    }, 0);
  });
}

function scanForTargets(): void {
  const ankiLabels = findAnkiLabels();

  for (const ankiLabel of ankiLabels) {
    const exampleRoot = findExampleRoot(ankiLabel);
    if (!exampleRoot) {
      continue;
    }

    const insertionAnchor =
      ankiLabel.closest<HTMLElement>('button, a, [role="button"]') ?? ankiLabel.parentElement;
    if (!insertionAnchor || !insertionAnchor.parentElement) {
      continue;
    }

    const actionRow = insertionAnchor.parentElement;
    const existingButtons = Array.from(
      actionRow.querySelectorAll<HTMLButtonElement>(`[${BUTTON_ATTR}="true"]`)
    );
    const preferredExistingButton =
      insertionAnchor.nextElementSibling instanceof HTMLButtonElement &&
      insertionAnchor.nextElementSibling.getAttribute(BUTTON_ATTR) === 'true'
        ? insertionAnchor.nextElementSibling
        : null;

    for (const existingButton of existingButtons) {
      if (existingButton !== preferredExistingButton) {
        existingButton.remove();
      }
    }

    if (preferredExistingButton) {
      continue;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Send to Latest Anki';
    button.setAttribute(BUTTON_ATTR, 'true');
    button.setAttribute(STATUS_ATTR, 'idle');
    button.style.marginLeft = '8px';
    button.style.padding = '6px 10px';
    button.style.border = '1px solid #1557a0';
    button.style.borderRadius = '6px';
    button.style.background = '#0f6cbd';
    button.style.color = '#fff';
    button.style.fontSize = '12px';
    button.style.cursor = 'pointer';

    button.addEventListener('click', () => {
      void handleClick(button, ankiLabel);
    });

    insertionAnchor.insertAdjacentElement('afterend', button);
  }
}

function findAnkiLabels(): HTMLElement[] {
  const labels = new Set<HTMLElement>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return cleanText(node.textContent ?? '') === 'Anki'
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    }
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    const parent = currentNode.parentElement;
    if (
      parent &&
      parent.offsetParent !== null &&
      !parent.closest(`[${BUTTON_ATTR}]`) &&
      !hasDescendantWithExactText(parent, 'Anki')
    ) {
      labels.add(parent);
    }
    currentNode = walker.nextNode();
  }

  return Array.from(labels);
}

async function handleClick(button: HTMLButtonElement, anchor: HTMLElement): Promise<void> {
  setButtonState(button, 'working', 'Sending...');

  try {
    const exampleRoot = findExampleRoot(anchor);
    if (!exampleRoot) {
      throw new Error('Could not find the example sentence in the current card');
    }
    const sentence = extractSentence(exampleRoot);
    if (!sentence) {
      throw new Error('Could not find the example sentence in the current card');
    }

    const translation = extractTranslation(exampleRoot);
    const title = extractTitle(exampleRoot);
    const miningToggle = findControl(exampleRoot, 'Mining');
    const mediaUrls = await resolveMediaUrls(exampleRoot, miningToggle);

    const payload: MiningPayload = {
      sentence,
      translation,
      title,
      imageUrl: mediaUrls.imageUrl,
      audioUrl: mediaUrls.audioUrl,
      search: readSearchContext()
    };

    const result = (await chrome.runtime.sendMessage({
      type: 'mine-example',
      payload
    } satisfies RuntimeMessage)) as MiningResult;

    if (!result.ok) {
      throw new Error(result.error);
    }

    setButtonState(button, 'success', 'Sent');
    window.setTimeout(() => setButtonState(button, 'idle', 'Send to Latest Anki'), 2000);
  } catch (error) {
    setButtonState(
      button,
      'error',
      error instanceof Error ? truncate(error.message, 42) : 'Failed'
    );
    window.setTimeout(() => setButtonState(button, 'idle', 'Send to Latest Anki'), 3000);
  }
}

function setButtonState(button: HTMLButtonElement, status: string, label: string): void {
  button.setAttribute(STATUS_ATTR, status);
  button.textContent = label;
  button.disabled = status === 'working';

  if (status === 'success') {
    button.style.background = '#0b7a3b';
    button.style.borderColor = '#0b7a3b';
    return;
  }

  if (status === 'error') {
    button.style.background = '#b42318';
    button.style.borderColor = '#b42318';
    return;
  }

  button.style.background = '#0f6cbd';
  button.style.borderColor = '#1557a0';
}

function findExampleRoot(anchor: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = anchor;

  while (current && current !== document.body) {
    if (isExampleRoot(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return anchor.parentElement;
}

function extractSentence(root: HTMLElement): string {
  const candidates = collectTextCandidates(root)
    .filter((text) => JAPANESE_RE.test(text))
    .filter((text) => !CONTROL_TEXT_RE.test(text))
    .sort(compareSentenceCandidates);

  return candidates[0] ?? '';
}

function extractTranslation(root: HTMLElement): string | undefined {
  const candidates = collectTextCandidates(root)
    .filter((text) => !JAPANESE_RE.test(text))
    .filter((text) => LATIN_RE.test(text))
    .filter((text) => text.length >= 20)
    .filter((text) => !CONTROL_TEXT_RE.test(text))
    .filter((text) => !/^https?:\/\//i.test(text))
    .sort((left, right) => right.length - left.length);

  return candidates[0];
}

function extractTitle(root: HTMLElement): string | undefined {
  const link = root.querySelector<HTMLAnchorElement>(
    'a[href*="/reader/"], a[href*="/games/"], a[href*="/literature/"]'
  );

  const title = cleanText(link?.textContent ?? '');
  return title.length > 0 ? title : undefined;
}

async function resolveMediaUrls(
  root: HTMLElement,
  miningToggle: HTMLElement | null
): Promise<{imageUrl?: string; audioUrl?: string}> {
  const initial = findMediaUrls(root);
  if (initial.imageUrl || initial.audioUrl) {
    return initial;
  }

  if (miningToggle) {
    miningToggle.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
    await wait(250);

    const afterOpen = findMediaUrls(root);
    if (afterOpen.imageUrl || afterOpen.audioUrl) {
      return afterOpen;
    }
  }

  return findGlobalMediaUrls();
}

function findMediaUrls(root: HTMLElement): {imageUrl?: string; audioUrl?: string} {
  const imageUrl = findFirstHttpSource(
    root.querySelectorAll<HTMLImageElement>(
      'img[src*="download_media"], img[src*="linodeobjects.com/immersionkit"]'
    ),
    'src'
  );

  const audioUrl =
    findFirstHttpSource(
      root.querySelectorAll<HTMLAudioElement>('audio[src], source[src]'),
      'src'
    ) ??
    findFirstHttpSource(
      root.querySelectorAll<HTMLElement>('[src*=".mp3"], [src*="download_media"]'),
      'src'
    );

  return {imageUrl, audioUrl};
}

function findGlobalMediaUrls(): {imageUrl?: string; audioUrl?: string} {
  const visiblePanels = Array.from(document.querySelectorAll<HTMLElement>('div, section, article'))
    .filter((element) => element.offsetParent !== null)
    .filter((element) => element.querySelector('img, audio, source'));

  for (const panel of visiblePanels) {
    const media = findMediaUrls(panel);
    if (media.imageUrl || media.audioUrl) {
      return media;
    }
  }

  return {};
}

function findFirstHttpSource<T extends Element>(
  elements: NodeListOf<T>,
  attribute: string
): string | undefined {
  for (const element of elements) {
    const value = element.getAttribute(attribute);
    if (value && /^https?:\/\//i.test(value)) {
      return value;
    }
  }

  return undefined;
}

function collectTextCandidates(root: HTMLElement): string[] {
  const texts = new Set<string>();

  for (const element of root.querySelectorAll<HTMLElement>('span, p, div, a, li, h1, h2, h3')) {
    if (element.closest(`[${BUTTON_ATTR}]`) || element.offsetParent === null) {
      continue;
    }

    const text = cleanText(element.innerText);
    if (text.length === 0) {
      continue;
    }

    texts.add(text);
  }

  return Array.from(texts);
}

function compareSentenceCandidates(left: string, right: string): number {
  const leftScore = sentenceCandidateScore(left);
  const rightScore = sentenceCandidateScore(right);
  return rightScore - leftScore;
}

function sentenceCandidateScore(value: string): number {
  let score = value.length;

  if (/[。！？」』】]/.test(value)) {
    score += 20;
  }
  if (value.length > 220) {
    score -= 80;
  }
  if (/\[[^\]]+\]/.test(value)) {
    score -= 10;
  }

  return score;
}

function containsLabel(root: HTMLElement, label: string): boolean {
  return Array.from(root.querySelectorAll<HTMLElement>('div,button,a,span')).some(
    (element) => cleanText(element.textContent ?? '') === label
  );
}

function countExactLabels(root: HTMLElement, label: string): number {
  return Array.from(root.querySelectorAll<HTMLElement>('div,button,a,span')).filter(
    (element) =>
      cleanText(element.textContent ?? '') === label && !hasDescendantWithExactText(element, label)
  ).length;
}

function isExampleRoot(root: HTMLElement): boolean {
  const text = cleanText(root.innerText);
  if (text.length === 0 || text.length > 2500) {
    return false;
  }

  const ankiCount = countExactLabels(root, 'Anki');
  if (ankiCount !== 1) {
    return false;
  }

  if (!containsLabel(root, 'Mining') || !containsLabel(root, 'Download')) {
    return false;
  }

  if (!JAPANESE_RE.test(text)) {
    return false;
  }

  return true;
}

function findControl(root: HTMLElement, label: string): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>('div,button,a,span')).find(
      (element) =>
        cleanText(element.textContent ?? '') === label &&
        !hasDescendantWithExactText(element, label)
    ) ?? null
  );
}

function hasDescendantWithExactText(root: HTMLElement, label: string): boolean {
  return Array.from(root.children).some(
    (child) =>
      child instanceof HTMLElement &&
      (cleanText(child.textContent ?? '') === label || hasDescendantWithExactText(child, label))
  );
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function readSearchContext(): SearchContext {
  const params = new URLSearchParams(window.location.search);
  return {
    keyword: params.get('keyword') ?? '',
    exactMatch: params.get('exact') === 'true',
    sort: params.get('sort') ?? undefined,
    jlpt: params.get('jlpt') ?? undefined,
    wk: params.get('wk') ?? undefined,
    category: params.get('category') ?? undefined,
    index: params.get('index') ?? undefined
  };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}
