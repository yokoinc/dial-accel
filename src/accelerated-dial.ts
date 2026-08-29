import { AdjustmentAction, type AdjustmentActionExecuteEvent } from '@logitech/plugin-sdk';

/**
 * Reglages de l'acceleration. Le SDK Logi 0.1.1 n'expose aucun panneau de
 * configuration : ces valeurs se modifient ici, puis `npm run build`.
 */
export const Tuning = {
  /**
   * Force de l'acceleration : frappes = crans x (1 + gain x ln(crans)).
   *
   * Le gain est logarithmique et non exponentiel : il mord tout de suite dans
   * les petites rotations, puis s'aplatit au lieu de s'emballer.
   *
   * Mesure sur la roulette le 2026-08-29 : de 1 a 6 crans par evenement.
   * A 0.6, cela donne 1, 2, 3, 4, 5, 7, 10, 12 frappes — le reglage retenu
   * apres essais dans OHIF. 1.2 etait deja trop nerveux, 1.8 s'emballait.
   *
   * 0 = aucune acceleration, le defilement devient strictement proportionnel.
   */
  gain: 0.6,

  /** Pause entre deux frappes d'une meme rafale. Zero = une seule salve `SendInput`. */
  repeatDelayMs: 0,

  /** Plafond de securite : nombre de frappes envoyees pour un seul evenement. */
  maxRepeats: 80,
} as const;

/**
 * Base des actions de molette : applique la courbe d'acceleration a chaque
 * evenement recu, puis delegue l'envoi a la sous-classe.
 *
 * Aucune accumulation ni temporisation : la console fournit deja un `tick`
 * proportionnel a la vitesse de rotation, donc la courbe s'applique directement
 * et la frappe part sans le moindre delai ajoute.
 */
export abstract class AcceleratedDialAction extends AdjustmentAction {
  readonly hasReset = false;

  /**
   * Plus petit `tick` jamais recu, qui sert d'unite « un cran ».
   *
   * Chaque controle a sa propre echelle : le gros cadran comme la roulette
   * envoient 2 pour un cran, mais le curseur « Vitesse de la molette »
   * d'Options+ change cette echelle. Plutot que de figer une constante mesuree
   * sur un seul controle, on retient le plus petit mouvement observe et on s'y
   * cale. Le premier evenement vaut donc toujours un cran, et le calibrage
   * s'affine des que l'utilisateur tourne plus lentement.
   */
  private smallestTick = Number.POSITIVE_INFINITY;

  /**
   * Envoie l'effet correspondant a une rafale.
   *
   * @param direction  +1 si la molette a tourne vers l'avant, -1 vers l'arriere
   * @param repeats    nombre de repetitions calcule par la courbe
   * @param delayMs    pause a respecter entre deux repetitions
   */
  protected abstract emit(direction: 1 | -1, repeats: number, delayMs: number): void;

  execute(event: AdjustmentActionExecuteEvent) {
    const magnitude = Math.abs(event.tick);
    if (magnitude === 0) {
      return;
    }

    this.smallestTick = Math.min(this.smallestTick, magnitude);

    const direction: 1 | -1 = event.tick > 0 ? 1 : -1;
    const detents = magnitude / this.smallestTick;
    const amplified = detents * (1 + Tuning.gain * Math.log(detents));
    const repeats = Math.min(Tuning.maxRepeats, Math.max(1, Math.round(amplified)));

    this.emit(direction, repeats, Tuning.repeatDelayMs);
  }
}
