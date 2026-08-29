# DialAccel

*[English version](README.md)*

Défilement accéléré à la molette pour la **MX Creative Console**, sous Windows.

Fait défiler les coupes dans OHIF (ou n'importe quelle visionneuse pilotée au
clavier) en envoyant des flèches haut/bas : plus la molette tourne vite, plus la
rafale de frappes est longue. Équivalent Logitech du plugin Stream Deck
[yokoinc/elgato-dial-scroll](https://github.com/yokoinc/elgato-dial-scroll).

## Comment ça marche

La console n'envoie pas un cran à la fois : elle regroupe déjà les crans selon
la vitesse de rotation et transmet un `tick` de 2 à 12. Le plugin calibre tout
seul son unité « un cran » sur le plus petit `tick` reçu, puis applique un gain
logarithmique :

```
frappes = crans × (1 + gain × ln(crans))
```

Logarithmique et non exponentiel : ça mord dès les premiers crans, puis ça
s'aplatit au lieu de s'emballer. Avec le gain retenu (0.6), une rotation de 1 à
6 crans donne 1, 2, 3, 4, 5, 7, 10, 12 frappes.

Les frappes partent par `SendInput` (Win32), appelé directement depuis Node via
[koffi](https://koffi.dev/). Aucun processus fils, aucun script : un appel
système par événement.

## Installation

```
npm install
npm run build:pack
```

Puis copier le contenu de `dist/` dans :

```
%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\DialAccel
```

et redémarrer le Logi Plugin Service :

```
Stop-Process -Name LogiPluginService,LogiPluginServiceExt -Force
Start-Process 'C:\Program Files\Logi\LogiPluginService\LogiPluginService.exe'
```

Le service ne relit jamais un plugin à chaud : ce redémarrage est obligatoire
après chaque build.

`npm run link` existe aussi, mais ne crée qu'un lien symbolique vers `dist/` —
pratique en développement, à proscrire en production : supprimer le dossier de
développement casserait le plugin.

## Deux pièges qui coûtent des heures

**1. Le runtime s'appelle `nodejs22`, pas `nodejs`.**
Le modèle généré par `@logitech/plugin-toolkit` 0.1.1 écrit `pluginRuntime: nodejs`
dans `package/metadata/LoupedeckPackage.yaml`. Le Logi Plugin Service 6.4 refuse
cette valeur. Corrigé ici, ne pas régénérer le modèle par-dessus.

De plus, le service télécharge son hôte Node dans `PluginHosts\node22` mais le
cherche sous `nodejs22`. Il faut créer la jonction une fois :

```
$h = "$env:LOCALAPPDATA\Logi\LogiPluginService\PluginHosts"
New-Item -ItemType Junction -Path "$h\nodejs22" -Target "$h\node22"
```

Sans elle, le journal dit `Plugin runtime 'NodeJs22' not yet installed`.

**2. Options+ applique un profil différent par application.**
Le Dialpad suit l'application active. Une action assignée dans le profil par
défaut ne s'exécutera pas dans Edge. Les onglets de profil sont en haut de
l'écran de personnalisation — assigner dans **celui de l'application visée**.

Vérification imparable : si le plugin n'écrit rien dans son journal quand on
tourne la molette, c'est qu'un autre profil est actif.

## Réglage

`gain`, en haut de [`src/accelerated-dial.ts`](src/accelerated-dial.ts).
Plus haut = plus nerveux, `0` = défilement strictement proportionnel.
Le SDK Logi 0.1.1 n'expose aucun panneau de configuration : il faut rebuilder.

## Diagnostic

Le journal du plugin, seule source de vérité :

```
%LOCALAPPDATA%\Logi\LogiPluginService\Logs\plugin_logs\DialAccel.log
```

Il n'accepte que l'ASCII — les accents y ressortent en mojibake. Les libellés
affichés dans Options+, eux, doivent garder leurs accents : la recherche
d'actions y est sensible.

## Limites

Le SDK Node 0.1.1 est en bêta et n'offre ni panneau de réglages, ni action sur
la bande tactile, ni filtre par application. Le gros cadran central impose son
incrustation à l'écran quelle que soit l'action posée dessus ; la roulette en
haut à droite n'a pas ce défaut.
