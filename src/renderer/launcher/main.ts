export {};

declare global {
  interface Window {
    launcherAPI: {
      getConfig: () => Promise<{ overlays: { id: string; label: string }[]; selected: string[] }>;
      start: (selectedIds: string[]) => void;
    };
  }
}

const list = document.getElementById('list') as HTMLUListElement;
const startButton = document.getElementById('start') as HTMLButtonElement;
const selectAllButton = document.getElementById('select-all') as HTMLButtonElement;
const selectNoneButton = document.getElementById('select-none') as HTMLButtonElement;

function checkboxes(): HTMLInputElement[] {
  return [...list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
}

async function init(): Promise<void> {
  const { overlays, selected } = await window.launcherAPI.getConfig();
  const selectedIds = new Set(selected);

  for (const overlay of overlays) {
    const item = document.createElement('li');
    item.className = 'launcher__item';

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = overlay.id;
    checkbox.checked = selectedIds.has(overlay.id);

    label.append(checkbox, document.createTextNode(overlay.label));
    item.append(label);
    list.append(item);
  }
}

startButton.addEventListener('click', () => {
  const selectedIds = checkboxes()
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
  window.launcherAPI.start(selectedIds);
});

selectAllButton.addEventListener('click', () => {
  for (const checkbox of checkboxes()) checkbox.checked = true;
});

selectNoneButton.addEventListener('click', () => {
  for (const checkbox of checkboxes()) checkbox.checked = false;
});

void init();
