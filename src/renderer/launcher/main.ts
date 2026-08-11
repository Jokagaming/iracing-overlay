export {};

interface LauncherProfile {
  id: string;
  name: string;
  selectedOverlayIds: string[];
}

declare global {
  interface Window {
    launcherAPI: {
      getConfig: () => Promise<{
        overlays: { id: string; label: string }[];
        profiles: LauncherProfile[];
        activeProfileId: string;
        runningOverlayIds: string[];
      }>;
      createProfile: (name: string) => Promise<LauncherProfile>;
      renameProfile: (profileId: string, name: string) => void;
      deleteProfile: (profileId: string) => Promise<{ profiles: LauncherProfile[]; activeProfileId: string }>;
      start: (profileId: string, selectedIds: string[]) => void;
    };
  }
}

const list = document.getElementById('list') as HTMLUListElement;
const startButton = document.getElementById('start') as HTMLButtonElement;
const selectAllButton = document.getElementById('select-all') as HTMLButtonElement;
const selectNoneButton = document.getElementById('select-none') as HTMLButtonElement;

const profileSelect = document.getElementById('profile-select') as HTMLSelectElement;
const profileNewButton = document.getElementById('profile-new') as HTMLButtonElement;
const profileRenameButton = document.getElementById('profile-rename') as HTMLButtonElement;
const profileDeleteButton = document.getElementById('profile-delete') as HTMLButtonElement;
const profileEditForm = document.getElementById('profile-edit') as HTMLDivElement;
const profileEditInput = document.getElementById('profile-edit-name') as HTMLInputElement;
const profileEditConfirm = document.getElementById('profile-edit-confirm') as HTMLButtonElement;
const profileEditCancel = document.getElementById('profile-edit-cancel') as HTMLButtonElement;

let overlays: { id: string; label: string }[] = [];
let profiles: LauncherProfile[] = [];
let runningOverlayIds: string[] = [];
let activeProfileId = '';
let editFormMode: 'create' | 'rename' | null = null;

function checkboxes(): HTMLInputElement[] {
  return [...list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
}

function currentProfile(): LauncherProfile | undefined {
  return profiles.find((p) => p.id === profileSelect.value);
}

function renderOverlayList(selectedIds: string[]): void {
  const selectedSet = new Set(selectedIds);
  list.innerHTML = '';

  for (const overlay of overlays) {
    const item = document.createElement('li');
    item.className = 'launcher__item';

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = overlay.id;
    checkbox.checked = selectedSet.has(overlay.id);

    label.append(checkbox, document.createTextNode(overlay.label));
    item.append(label);
    list.append(item);
  }
}

/** Fuer das aktive Profil die live laufenden Fenster zeigen (falls welche offen sind), sonst die gespeicherte Auswahl. */
function showOverlaysForSelectedProfile(): void {
  const profile = currentProfile();
  if (!profile) return;
  const selection = profile.id === activeProfileId && runningOverlayIds.length > 0 ? runningOverlayIds : profile.selectedOverlayIds;
  renderOverlayList(selection);
}

function renderProfileSelect(): void {
  profileSelect.innerHTML = '';
  for (const profile of profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    profileSelect.append(option);
  }
  profileSelect.value = activeProfileId;
  // Es muss immer mindestens ein Profil geben - loeschen erst ab dem zweiten moeglich.
  profileDeleteButton.disabled = profiles.length <= 1;
}

function closeEditForm(): void {
  editFormMode = null;
  profileEditForm.classList.add('is-hidden');
}

function openEditForm(mode: 'create' | 'rename'): void {
  editFormMode = mode;
  profileEditInput.value = mode === 'rename' ? (currentProfile()?.name ?? '') : '';
  profileEditForm.classList.remove('is-hidden');
  profileEditInput.focus();
  profileEditInput.select();
}

async function handleEditConfirm(): Promise<void> {
  const name = profileEditInput.value.trim();
  if (!name) return;

  if (editFormMode === 'create') {
    const profile = await window.launcherAPI.createProfile(name);
    profiles.push(profile);
    renderProfileSelect();
    profileSelect.value = profile.id;
    renderOverlayList(profile.selectedOverlayIds);
  } else if (editFormMode === 'rename') {
    const profile = currentProfile();
    if (profile) {
      profile.name = name;
      window.launcherAPI.renameProfile(profile.id, name);
      renderProfileSelect();
    }
  }

  closeEditForm();
}

async function handleDelete(): Promise<void> {
  const profile = currentProfile();
  if (!profile || profiles.length <= 1) return;
  if (!confirm(`Profil "${profile.name}" wirklich loeschen? Die zugehoerigen Fensterpositionen gehen dabei verloren.`)) return;

  const result = await window.launcherAPI.deleteProfile(profile.id);
  profiles = result.profiles;
  activeProfileId = result.activeProfileId;
  runningOverlayIds = [];
  renderProfileSelect();
  showOverlaysForSelectedProfile();
}

async function init(): Promise<void> {
  const config = await window.launcherAPI.getConfig();
  overlays = config.overlays;
  profiles = config.profiles;
  activeProfileId = config.activeProfileId;
  runningOverlayIds = config.runningOverlayIds;

  renderProfileSelect();
  showOverlaysForSelectedProfile();
}

profileSelect.addEventListener('change', showOverlaysForSelectedProfile);
profileNewButton.addEventListener('click', () => openEditForm('create'));
profileRenameButton.addEventListener('click', () => openEditForm('rename'));
profileEditCancel.addEventListener('click', closeEditForm);
profileEditConfirm.addEventListener('click', () => void handleEditConfirm());
profileEditInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void handleEditConfirm();
  if (event.key === 'Escape') closeEditForm();
});
profileDeleteButton.addEventListener('click', () => void handleDelete());

startButton.addEventListener('click', () => {
  const profile = currentProfile();
  if (!profile) return;
  const selectedIds = checkboxes()
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
  window.launcherAPI.start(profile.id, selectedIds);
});

selectAllButton.addEventListener('click', () => {
  for (const checkbox of checkboxes()) checkbox.checked = true;
});

selectNoneButton.addEventListener('click', () => {
  for (const checkbox of checkboxes()) checkbox.checked = false;
});

void init();
