export {};

declare global {
  interface Window {
    overlayTestAPI: {
      onEditModeChange: (callback: (editMode: boolean) => void) => void;
      getEditMode: () => Promise<boolean>;
    };
  }
}

const box = document.getElementById('box') as HTMLDivElement;
const status = document.getElementById('status') as HTMLParagraphElement;
const counterEl = document.getElementById('counter') as HTMLParagraphElement;
const btn = document.getElementById('btn') as HTMLButtonElement;

let clicks = 0;
btn.addEventListener('click', () => {
  clicks += 1;
  counterEl.textContent = `Testklicks: ${clicks}`;
});

function applyEditMode(editMode: boolean): void {
  box.dataset.edit = String(editMode);
  status.textContent = editMode ? 'Klickdurchlaessig: AUS (Edit-Modus)' : 'Klickdurchlaessig: AN';
}

window.overlayTestAPI.getEditMode().then(applyEditMode);
window.overlayTestAPI.onEditModeChange(applyEditMode);
