import { AcceleratedDialAction } from './accelerated-dial';
import { Mod, Vk, sendKey } from './win-input';

/**
 * L'unique action du plugin : defiler les coupes dans OHIF a la roulette.
 *
 * Convention : rotation vers la droite = Fleche bas, on avance dans la serie.
 *
 * Le libelle porte ses accents — c'est sur lui que porte la recherche
 * d'Options+, et « accéléré » sans accent ne se trouve pas. Les messages de
 * journal, eux, restent en ASCII : le fichier de log mange les caracteres
 * accentues.
 */
export class OhifScrollAction extends AcceleratedDialAction {
  /**
   * Ne pas renommer. Options+ retient les affectations par cet identifiant, et
   * celui-ci vient du niveau « doux » de l'ancienne serie de trois actions :
   * le changer obligerait a reassigner la roulette a la main.
   */
  readonly name = 'dial_scroll_arrows_gentle';

  displayName = 'Défilement OHIF';
  description =
    'Fait défiler les coupes à la roulette. Flèche bas / Flèche haut, de plus en plus vite selon la vitesse de rotation.';

  protected emit(direction: 1 | -1, repeats: number, delayMs: number) {
    sendKey(direction > 0 ? Vk.DOWN : Vk.UP, Mod.NONE, repeats, delayMs);
  }
}
