# DialAccel

*[Version française](README.fr.md)*

Accelerated scrolling for the **Logitech MX Creative Console**, on Windows.

Turn the dial, and the plugin sends up/down arrow keys. The faster you turn, the
longer the burst — one keystroke per detent when you creep, a dozen when you
spin. Built to scroll through slices in a DICOM viewer such as OHIF, but it
works with anything driven by the arrow keys.

Logitech counterpart of the Stream Deck plugin
[yokoinc/elgato-dial-scroll](https://github.com/yokoinc/elgato-dial-scroll).

---

## Install

Four steps, and no development tools of any kind.

### 1. Work around a Logitech naming bug — once per machine

The Plugin Service unpacks its runtime into a folder named `node22`, then looks
for it under `nodejs22`. Until both names exist it refuses to load this kind of
plugin. Paste this into PowerShell:

```
$h = "$env:LOCALAPPDATA\Logi\LogiPluginService\PluginHosts"
New-Item -ItemType Junction -Path "$h\nodejs22" -Target "$h\node22"
```

If it answers that the target does not exist, open Logi Options+ and let it
finish starting — it fetches the runtime by itself — then run the command again.

### 2. Drop the plugin into place

Download [`DialAccel.lplug4`](DialAccel.lplug4). It is a plain zip: extract its
**contents** — not the folder — into

```
%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\DialAccel
```

You should end up with `index.mjs`, `metadata\`, `node_modules\` and the two
icon folders directly inside `DialAccel`.

### 3. Restart the Plugin Service

It never reloads a plugin while running, so this is mandatory:

```
Stop-Process -Name LogiPluginService,LogiPluginServiceExt -Force
Start-Process 'C:\Program Files\Logi\LogiPluginService\LogiPluginService.exe'
```

### 4. Assign the action in Options+

Open the device customisation screen. The action appears under **Actions Dial
Accel**, named **Défilement OHIF**.

Two things that trip people up here:

- **Assign it in the right profile.** The tabs at the top of the screen are
  per-application profiles, and the console follows whichever application is in
  front. An action assigned in the default profile will not run inside your
  browser. Pick the tab for the application you actually use.
- **Prefer the roller, top right.** The large central dial forces an on-screen
  overlay whatever you put on it. The roller does not.

Done — turn the roller and the view scrolls.

---

## Tuning

One setting: `gain`, at the top of
[`src/accelerated-dial.ts`](src/accelerated-dial.ts).

| gain | 1 to 6 detents give | feel |
|------|---------------------|------|
| 0    | 1, 2, 3, 4, 5, 6    | no acceleration at all |
| 0.6  | 1, 2, 3, 4, 5, 7, 10, 12 | the shipped default |
| 1.2  | 1, 2, 3, 5, 7, 11, 15, 19 | brisk |
| 2.0  | 1, 3, 5, 7, 10, 15, 21, 28 | aggressive |

The Logi SDK 0.1.1 exposes no settings panel, so changing it means rebuilding
(see below). If you want several strengths available in Options+ without
rebuilding, register several actions with different gains.

---

## Troubleshooting

The plugin log is the only source of truth:

```
%LOCALAPPDATA%\Logi\LogiPluginService\Logs\plugin_logs\DialAccel.log
```

| What the log says | What it means |
|---|---|
| `Unknown plugin runtime type 'nodejs'` | The manifest says `nodejs`. It must say `nodejs22`. |
| `Plugin runtime 'NodeJs22' not yet installed` | The junction from step 1 is missing. |
| `Starting remote plugin` then `Init connection confirmed` | The plugin is loaded and healthy. |
| **Nothing at all** while you turn the dial | The action is assigned in a profile that is not the active one. See step 4. |

The log only handles ASCII — accented characters come out as mojibake, which is
expected. The labels shown inside Options+ keep their accents, and must: its
action search is accent-sensitive.

---

## Build from source

```
npm install
npm run build:pack
```

This produces `dist/` and `DialAccel.lplug4`. Install as in steps 2 and 3 above.

`npm run link` also exists, but only symlinks `dist/` into the plugins folder.
It is convenient while developing and wrong for real use: deleting the source
folder would break the plugin.

Rebuilding while the plugin is running is fine — `clean` deliberately spares
`dist/node_modules`, because the plugin holds koffi's native binary open and
deleting it would fail every build.

---

## How it works

The console does not report one detent at a time. Its firmware already batches
them by rotation speed and sends a `tick` between 2 and 12. The plugin
calibrates its own "one detent" unit on the smallest `tick` it has seen — every
control, and every Options+ speed setting, has a different scale — then applies
a logarithmic gain:

```
keystrokes = detents × (1 + gain × ln(detents))
```

Logarithmic rather than exponential: it bites from the very first detents, then
flattens out instead of running away. There is no accumulation and no timer, so
nothing is added to the latency.

Keystrokes are delivered through Win32 `SendInput`, called straight from Node
via [koffi](https://koffi.dev/) — no child process, no script, one syscall per
event.

---

## Limitations

The Logi Node SDK 0.1.1 is beta. It offers no settings panel, no touch-strip
action, and no per-application filtering from inside the plugin. The large
central dial always shows its on-screen overlay. None of these can be worked
around from the plugin side.
