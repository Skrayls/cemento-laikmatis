'use strict';

const storageKey = 'cemento-laikmatis-v1';
const stages = [
  'Maišymo pradžia',
  'Maišymo pabaiga',
  'Cemento panaudojimo pradžia',
  'Cemento panaudojimo pabaiga',
  'Stingimas patvirtintas'
];

const elapsed = document.querySelector('#elapsed');
const status = document.querySelector('#status');
const start = document.querySelector('#start');
const reset = document.querySelector('#reset');
const dialog = document.querySelector('#confirm-reset');
const message = document.querySelector('#message');
const fullscreen = document.querySelector('#fullscreen');
const list = document.querySelector('#stages');
let state;
let clockAnchor;
let clockReliable = true;
let storageAvailable = true;
let resetTarget;

function notify(text) {
  message.textContent = text;
  message.hidden = false;
}

function readState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey));
  } catch {
    notify('Nepavyko atkurti ciklo. Patikrinkite laiką pagal atsarginį laikmatį.');
    return null;
  }
}

function setState(next) {
  state = next;
  clockReliable = true;
  clockAnchor = next && { elapsed: Date.now() - next.startedAt, monotonic: performance.now() };
  if (clockAnchor && clockAnchor.elapsed < (next.finishedAt ?? next.marks.at(-1) ?? 0)) {
    clockReliable = false;
  }
  render();
}

function update(change) {
  const current = storageAvailable ? readState() : state;
  if (JSON.stringify(state) !== JSON.stringify(current)) {
    setState(current);
    notify('Ciklas pakeistas kitame skirtuke. Patikrinkite rodomas žymas.');
    return;
  }

  const next = change();
  if (next === undefined) return;
  message.hidden = true;
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
    notify('Naršyklė neišsaugo ciklo. Neuždarykite ir neatnaujinkite puslapio.');
  }
  setState(next);
}

function format(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  return hours ? [hours, minutes, remainder].join(':') : [minutes, remainder].join(':');
}

function currentElapsed() {
  return clockAnchor.elapsed + performance.now() - clockAnchor.monotonic;
}

function tick() {
  let time = state?.finishedAt ?? 0;
  if (state && state.finishedAt === null) {
    time = currentElapsed();
    if (Math.abs(Date.now() - state.startedAt - time) > 3000) clockReliable = false;
  }

  elapsed.classList.toggle('hours', time >= 3600000);
  elapsed.textContent = clockReliable ? format(time) : '—';
  if (!clockReliable) {
    notify('Įrenginio laikas pasikeitė. Patikrinkite atsarginį laikmatį ir pradėkite naują ciklą.');
    for (const button of list.querySelectorAll('button')) button.disabled = true;
  }
}

function render() {
  const active = state !== null && state.finishedAt === null;
  start.hidden = state !== null;
  reset.hidden = state === null;
  status.textContent = active ? 'Ciklas vyksta' : state ? 'Ciklas baigtas rankiniu būdu' : 'Paruošta pradėti';

  const rows = stages.map((label, index) => {
    const row = document.createElement('li');
    const title = document.createElement('span');
    title.textContent = label;
    row.append(title);
    const recordedTime = state?.marks[index];
    if (recordedTime !== undefined) {
      const time = document.createElement('time');
      time.dateTime = 'PT' + Math.floor(recordedTime / 1000) + 'S';
      time.textContent = '+' + format(recordedTime);
      row.append(time);
    } else if (index !== 0) {
      const button = document.createElement('button');
      button.className = 'secondary';
      button.textContent = 'Pažymėti';
      button.setAttribute('aria-label', 'Pažymėti: ' + label);
      button.disabled = !active || state.marks.length !== index;
      button.addEventListener('click', () => {
        update(() => {
          tick();
          if (!clockReliable) return undefined;
          const time = Math.floor(currentElapsed());
          return {
            ...state,
            marks: [...state.marks, time],
            finishedAt: index === stages.length - 1 ? time : null
          };
        });
        (list.querySelector('button:not(:disabled)') || reset).focus();
      });
      row.append(button);
    }
    return row;
  });
  list.replaceChildren(...rows);
  tick();
}

start.addEventListener('click', () => {
  update(() => ({ startedAt: Date.now(), marks: [0], finishedAt: null }));
  (list.querySelector('button:not(:disabled)') || reset).focus();
});
reset.addEventListener('click', () => {
  resetTarget = state;
  dialog.returnValue = 'cancel';
  dialog.showModal();
});
dialog.addEventListener('close', () => {
  if (dialog.returnValue !== 'reset') return;
  if (resetTarget !== state) {
    notify('Ciklas pasikeitė. Patikrinkite jį prieš išvalydami.');
    return;
  }
  update(() => null);
  if (!start.hidden) start.focus();
});
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) setState(readState());
});
document.addEventListener('visibilitychange', tick);

if (document.fullscreenEnabled) {
  fullscreen.hidden = false;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify('Šioje naršyklėje nepavyko įjungti viso ekrano.');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.textContent = document.fullscreenElement ? 'Išeiti iš viso ekrano' : 'Visas ekranas';
  });
}

setState(readState());
setInterval(tick, 200);
