import portraits from '../assets/general-portraits.png';
import { GENERAL_PORTRAITS } from '../../../packages/game-core/portraits.js';

export function GeneralPortrait({ portraitId, name }) {
  const index = GENERAL_PORTRAITS.find(p => p.id === portraitId)?.index ?? 0;
  return <span className="game-art general-portrait" role="img" aria-label={`Porträt von ${name ?? 'General'}`} style={{
    backgroundImage: `url(${portraits})`, backgroundSize: '500% 400%',
    backgroundPosition: `${index % 5 * 25}% ${Math.floor(index / 5) * (100 / 3)}%`,
  }}/>;
}
