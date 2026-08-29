import koffi from 'koffi';

/**
 * Envoi de frappes clavier et de crans de molette a Windows, via `SendInput`.
 *
 * Node n'a pas d'acces direct a l'API Win32. On passe donc par koffi, une
 * passerelle FFI qui appelle `user32.dll` depuis le processus du plugin.
 * Aucun processus fils, aucun script : un appel systeme direct, en quelques
 * microsecondes.
 *
 * Ce module suppose Windows 64 bits, ce qui est le cas de l'hote Node fourni
 * par le Logi Plugin Service.
 */

/** Masques de modificateurs, combinables avec | */
export const Mod = { NONE: 0, CTRL: 1, ALT: 2, SHIFT: 4 } as const;

/** Codes de touches virtuelles Windows utiles ici. */
export const Vk = {
  CTRL: 0x11,
  ALT: 0x12,
  SHIFT: 0x10,
  UP: 0x26,
  DOWN: 0x28,
  LEFT: 0x25,
  RIGHT: 0x27,
  PAGE_UP: 0x21,
  PAGE_DOWN: 0x22,
  HOME: 0x24,
  END: 0x23,
} as const;

/** Un cran de molette Windows. */
export const WHEEL_DELTA = 120;

const INPUT_MOUSE = 0;
const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const MOUSEEVENTF_WHEEL = 0x0800;

/** Ordre des masques de `Mod`, pour retrouver la touche correspondante. */
const MODIFIER_KEYS = [Vk.CTRL, Vk.ALT, Vk.SHIFT];

type NativeInput = { type: number; u: Record<string, unknown> };

type Win32 = {
  sendInput: (count: number, inputs: NativeInput[], size: number) => number;
  inputSize: number;
};

let win32: Win32 | null = null;
let loadFailed = false;

function loadWin32(): Win32 | null {
  if (win32 !== null || loadFailed) {
    return win32;
  }

  try {
    const user32 = koffi.load('user32.dll');

    // Les structures de https://learn.microsoft.com/windows/win32/api/winuser/ns-winuser-input
    const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
      dx: 'int32_t',
      dy: 'int32_t',
      mouseData: 'int32_t',
      dwFlags: 'uint32_t',
      time: 'uint32_t',
      dwExtraInfo: 'uint64_t',
    });
    const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
      wVk: 'uint16_t',
      wScan: 'uint16_t',
      dwFlags: 'uint32_t',
      time: 'uint32_t',
      dwExtraInfo: 'uint64_t',
    });
    const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', {
      uMsg: 'uint32_t',
      wParamL: 'uint16_t',
      wParamH: 'uint16_t',
    });
    koffi.union('INPUT_UNION', { mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT });
    const INPUT = koffi.struct('INPUT', { type: 'uint32_t', u: 'INPUT_UNION' });

    const sendInput = user32.func(
      'uint32_t __stdcall SendInput(uint32_t cInputs, INPUT *pInputs, int cbSize)',
    ) as Win32['sendInput'];

    win32 = { sendInput, inputSize: koffi.sizeof(INPUT) };
    return win32;
  } catch (error) {
    loadFailed = true;
    console.error('[win-input] chargement de user32 impossible:', (error as Error).message);
    return null;
  }
}

function keyEvent(vk: number, keyUp: boolean): NativeInput {
  return {
    type: INPUT_KEYBOARD,
    u: { ki: { wVk: vk, wScan: 0, dwFlags: keyUp ? KEYEVENTF_KEYUP : 0, time: 0, dwExtraInfo: 0 } },
  };
}

function wheelEvent(delta: number): NativeInput {
  return {
    type: INPUT_MOUSE,
    u: { mi: { dx: 0, dy: 0, mouseData: delta, dwFlags: MOUSEEVENTF_WHEEL, time: 0, dwExtraInfo: 0 } },
  };
}

function dispatch(inputs: NativeInput[]) {
  const api = loadWin32();
  if (api === null || inputs.length === 0) {
    return;
  }

  const sent = api.sendInput(inputs.length, inputs, api.inputSize);
  if (sent !== inputs.length) {
    console.error(`[win-input] ${sent}/${inputs.length} evenements acceptes par Windows`);
  }
}

/**
 * Repete `count` fois la frappe `vk`, modificateurs maintenus pendant la rafale.
 *
 * Tout part dans un seul appel systeme : Windows met les evenements dans la
 * file d'entree et l'application les traite dans l'ordre. `delayMs` n'est
 * respecte que s'il est non nul, auquel cas la rafale est etalee sans jamais
 * bloquer la boucle d'evenements.
 */
export function sendKey(vk: number, modifiers: number, count: number, delayMs: number) {
  if (count <= 0) {
    return;
  }

  const held = MODIFIER_KEYS.filter((_, bit) => modifiers & (1 << bit));

  if (delayMs <= 0) {
    dispatch([
      ...held.map((key) => keyEvent(key, false)),
      ...Array.from({ length: count }, () => [keyEvent(vk, false), keyEvent(vk, true)]).flat(),
      ...held.map((key) => keyEvent(key, true)),
    ]);
    return;
  }

  dispatch(held.map((key) => keyEvent(key, false)));
  for (let i = 0; i < count; i += 1) {
    setTimeout(() => {
      dispatch([keyEvent(vk, false), keyEvent(vk, true)]);
      if (i === count - 1) {
        dispatch(held.map((key) => keyEvent(key, true)));
      }
    }, i * delayMs);
  }
}

/**
 * Fait defiler la molette de `count` crans.
 *
 * Un seul evenement porte le total plutot que `count` evenements successifs :
 * les applications traitent le delta proportionnellement, ce qui donne un
 * defilement continu au lieu d'un escalier.
 */
export function sendWheel(delta: number, count: number, _delayMs: number) {
  if (count > 0) {
    dispatch([wheelEvent(delta * count)]);
  }
}

/** Charge user32 des le lancement, pour que le premier cran ne paie pas l'initialisation. */
export function warmUpInput() {
  if (loadWin32() !== null) {
    console.log('[win-input] user32 charge via koffi');
  }
}

/** Plus rien a fermer : conserve pour la symetrie avec l'arret du plugin. */
export function shutdownInput() {
  // L'appel FFI est synchrone et sans etat : rien a liberer.
}
