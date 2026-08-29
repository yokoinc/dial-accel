# DialAccel

*[English version](README.md)*

Défilement accéléré pour la **Logitech MX Creative Console**, sous Windows.

Tu tournes la molette, le plugin envoie des flèches haut/bas. Plus tu tournes
vite, plus la rafale est longue — une frappe par cran quand tu vas doucement,
une douzaine quand tu accélères. Conçu pour faire défiler les coupes dans une
visionneuse DICOM comme OHIF, mais ça marche avec tout ce qui se pilote aux
flèches.

Équivalent Logitech du plugin Stream Deck
[yokoinc/elgato-dial-scroll](https://github.com/yokoinc/elgato-dial-scroll).

---

## Installation

Quatre étapes. Aucune ne demande Node ni de compiler quoi que ce soit.

### 1. Créer la jonction de l'hôte Node — une fois par machine

Le Plugin Service télécharge son hôte Node dans un dossier nommé `node22`, mais
le cherche sous `nodejs22`. Tant que cette jonction n'existe pas, aucun plugin JS
ne peut se charger. Dans PowerShell :

```
$h = "$env:LOCALAPPDATA\Logi\LogiPluginService\PluginHosts"
New-Item -ItemType Junction -Path "$h\nodejs22" -Target "$h\node22"
```

Si `node22` n'existe pas encore, ouvre Logi Options+ et laisse-le démarrer
complètement — le service télécharge l'hôte tout seul — puis relance la commande.

### 2. Déposer le plugin

Télécharge [`DialAccel.lplug4`](DialAccel.lplug4). C'est une simple archive zip :
extrais son **contenu** — pas le dossier — dans

```
%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\DialAccel
```

Tu dois obtenir `index.mjs`, `metadata\`, `node_modules\` et les deux dossiers
d'icônes directement dans `DialAccel`.

### 3. Redémarrer le Plugin Service

Il ne relit jamais un plugin à chaud, cette étape est donc obligatoire :

```
Stop-Process -Name LogiPluginService,LogiPluginServiceExt -Force
Start-Process 'C:\Program Files\Logi\LogiPluginService\LogiPluginService.exe'
```

### 4. Assigner l'action dans Options+

Ouvre l'écran de personnalisation du périphérique. L'action apparaît sous
**Actions Dial Accel**, sous le nom **Défilement OHIF**.

Deux choses qui font perdre du temps ici :

- **Assigne-la dans le bon profil.** Les onglets en haut de l'écran sont des
  profils par application, et la console suit l'application au premier plan. Une
  action assignée dans le profil par défaut ne s'exécutera pas dans ton
  navigateur. Choisis l'onglet de l'application que tu utilises vraiment.
- **Préfère la roulette, en haut à droite.** Le gros cadran central impose une
  incrustation à l'écran quoi que tu poses dessus. La roulette, non.

C'est tout — tourne la roulette et ça défile.

---

## Réglage

Un seul paramètre : `gain`, en haut de
[`src/accelerated-dial.ts`](src/accelerated-dial.ts).

| gain | 1 à 6 crans donnent | ressenti |
|------|---------------------|----------|
| 0    | 1, 2, 3, 4, 5, 6    | aucune accélération |
| 0.6  | 1, 2, 3, 4, 5, 7, 10, 12 | le réglage livré |
| 1.2  | 1, 2, 3, 5, 7, 11, 15, 19 | vif |
| 2.0  | 1, 3, 5, 7, 10, 15, 21, 28 | nerveux |

Le SDK Logi 0.1.1 n'expose aucun panneau de configuration : changer ce chiffre
impose de reconstruire (voir plus bas). Pour disposer de plusieurs niveaux
directement dans Options+ sans reconstruire, il suffit de déclarer plusieurs
actions avec des gains différents.

---

## En cas de problème

Le journal du plugin est la seule source de vérité :

```
%LOCALAPPDATA%\Logi\LogiPluginService\Logs\plugin_logs\DialAccel.log
```

| Ce que dit le journal | Ce que ça veut dire |
|---|---|
| `Unknown plugin runtime type 'nodejs'` | Le manifeste dit `nodejs`. Il doit dire `nodejs22`. |
| `Plugin runtime 'NodeJs22' not yet installed` | La jonction de l'étape 1 manque. |
| `Starting remote plugin` puis `Init connection confirmed` | Le plugin est chargé et fonctionne. |
| **Rien du tout** quand tu tournes la molette | L'action est assignée dans un profil qui n'est pas l'actif. Voir l'étape 4. |

Le journal ne gère que l'ASCII — les accents y ressortent en charabia, c'est
normal. Les libellés affichés dans Options+, eux, gardent leurs accents, et
doivent les garder : la recherche d'actions y est sensible.

---

## Construire depuis les sources

```
npm install
npm run build:pack
```

Ça produit `dist/` et `DialAccel.lplug4`. L'installation suit les étapes 2 et 3
ci-dessus.

`npm run link` existe aussi, mais ne fait qu'un lien symbolique de `dist/` vers
le dossier des plugins. Pratique en développement, à proscrire en vrai usage :
supprimer le dossier source casserait le plugin.

Reconstruire pendant que le plugin tourne fonctionne — `clean` épargne
volontairement `dist/node_modules`, parce que le plugin garde le binaire natif de
koffi ouvert et que le supprimer ferait échouer chaque build.

---

## Comment ça marche

La console n'envoie pas un cran à la fois. Son micrologiciel les regroupe déjà
selon la vitesse de rotation et transmet un `tick` entre 2 et 12. Le plugin
calibre tout seul son unité « un cran » sur le plus petit `tick` reçu — chaque
contrôle, et chaque réglage de vitesse d'Options+, a une échelle différente —
puis applique un gain logarithmique :

```
frappes = crans × (1 + gain × ln(crans))
```

Logarithmique et non exponentiel : ça mord dès les premiers crans, puis ça
s'aplatit au lieu de s'emballer. Aucune accumulation, aucune temporisation :
rien n'est ajouté à la latence.

Les frappes partent par `SendInput` (Win32), appelé directement depuis Node via
[koffi](https://koffi.dev/) — aucun processus fils, aucun script, un appel
système par événement.

---

## Limites

Le SDK Node de Logitech est en version 0.1.1, en bêta. Il n'offre ni panneau de
réglages, ni action sur la bande tactile, ni filtrage par application depuis le
plugin. Le gros cadran central affiche toujours son incrustation. Rien de tout
cela ne se contourne côté plugin.
