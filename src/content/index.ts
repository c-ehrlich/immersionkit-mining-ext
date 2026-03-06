import type {MiningPayload, MiningResult, RuntimeMessage, SearchContext} from '../shared/types';

const BUTTON_ATTR = 'data-mining-ext-button';
const STATUS_ATTR = 'data-mining-ext-status';

observePage();
scanForTargets();

function observePage(): void {
  const observer = new MutationObserver(() => {
    scanForTargets();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function scanForTargets(): void {
  const miningLabels = Array.from(document.querySelectorAll<HTMLElement>('div,button,a')).filter(
    (element) =>
      element.textContent?.trim() === 'Mining' &&
      !element.hasAttribute(BUTTON_ATTR) &&
      !element.closest(`[${BUTTON_ATTR}]`)
  );

  for (const miningLabel of miningLabels) {
    const parent = miningLabel.parentElement;
    if (!parent || parent.querySelector(`[${BUTTON_ATTR}="true"]`)) {
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
      void handleClick(button, miningLabel);
    });

    parent.appendChild(button);
  }
}

async function handleClick(button: HTMLButtonElement, anchor: HTMLElement): Promise<void> {
  setButtonState(button, 'working', 'Sending...');

  try {
    const sentence = extractSentence(anchor);
    if (!sentence) {
      throw new Error('Could not find the example sentence in the current card');
    }

    const payload: MiningPayload = {
      sentence,
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

function extractSentence(anchor: HTMLElement): string {
  const container = anchor.closest('div[class], article, section, li, tr') ?? anchor.parentElement;
  if (!container) {
    return '';
  }

  const candidates = Array.from(container.querySelectorAll<HTMLElement>('span, p, div'))
    .map((element) => element.innerText.trim())
    .filter((text) => text.length > 0)
    .filter((text) => /[\u3040-\u30ff\u3400-\u9faf]/.test(text))
    .filter((text) => !/^(Mining|Download|Image|Sound|Translation|Sentence)$/.test(text));

  candidates.sort((left, right) => right.length - left.length);
  return candidates[0] ?? '';
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
