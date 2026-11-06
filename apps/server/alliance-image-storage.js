import { createHash } from 'node:crypto';
import { validateAllianceImage, ALLIANCE_IMAGE_LIMITS as L } from '../../packages/game-core/alliance-images.js';
export function validateStoredAllianceImages(world) {
  for(const a of world.alliances.items){
    validateAllianceImage(a);if(!a.image)continue;
    const data=Buffer.from(a.image.data,'base64');
    if(data.length>L.maxOutputBytes||data.toString('base64')!==a.image.data||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP'||data.readUInt32LE(4)+8!==data.length||createHash('sha256').update(data).digest('hex')!==a.image.hash)throw new Error('Beschädigtes gespeichertes Bündnisbild.');
  }
}
