// Short-lived, isolated decoder process. Never receives paths or URLs.
import sharp from 'sharp';
import { inflateSync } from 'node:zlib';
import { ALLIANCE_IMAGE_LIMITS as L } from '../../packages/game-core/alliance-images.js';
sharp.cache(false); sharp.concurrency(1);
process.once('message', async ({ buffer, mime }) => {
  try {
    const input = Buffer.from(buffer);
    const png = input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = input.length >= 3 && input[0] === 255 && input[1] === 216 && input[2] === 255;
    const webp = input.toString('ascii',0,4) === 'RIFF' && input.toString('ascii',8,12) === 'WEBP';
    const format = png ? 'png' : jpeg ? 'jpeg' : webp ? 'webp' : null;
    if (!format || mime !== `image/${format}` || input.length > L.maxBytes) throw new Error();
    if (png) { // APNG is not supported, even when a decoder exposes only its first frame.
      let offset=8, end=false, chunks=0, metadataBytes=0;
      while(offset+12<=input.length){const size=input.readUInt32BE(offset),tag=input.toString('ascii',offset+4,offset+8);if(size>input.length-offset-12 || tag==='acTL')throw new Error();if(++chunks>4096)throw new Error();
        if(['iCCP','zTXt','iTXt'].includes(tag)){
          const body=input.subarray(offset+8,offset+8+size);if(size>131072)throw new Error();
          const zero=body.indexOf(0);if(zero<1||zero>79)throw new Error();
          let textStart=zero+2,compressed=true;
          if(tag==='iTXt'){compressed=body[zero+1]===1;const languageEnd=body.indexOf(0,zero+3),translatedEnd=body.indexOf(0,languageEnd+1);if(languageEnd<0||translatedEnd<0)throw new Error();textStart=translatedEnd+1;}
          const text=compressed?inflateSync(body.subarray(textStart),{maxOutputLength:65536}):body.subarray(textStart);
          metadataBytes+=text.length;if(metadataBytes>131072)throw new Error();
        }
        offset+=size+12;if(tag==='IEND'){end=true;break;}}
      if(!end)throw new Error();
    }
    const image = sharp(input, { failOn:'warning', limitInputPixels:L.maxPixels, sequentialRead:true, animated:false });
    const metadata = await image.metadata();
    if (metadata.format !== format || !metadata.width || !metadata.height || metadata.width > L.maxDimension || metadata.height > L.maxDimension || (metadata.pages ?? 1) !== 1) throw new Error();
    // No withMetadata: EXIF, GPS, comments, profiles and foreign trailing data are discarded.
    const output = await image.rotate().resize(L.side,L.side,{fit:'cover',position:'centre'}).toColourspace('srgb').webp({quality:82,effort:3}).toBuffer();
    if (output.length > L.maxOutputBytes) throw new Error();
    process.send({ok:true,buffer:output},()=>process.disconnect());
  } catch { process.send({ok:false},()=>process.disconnect()); }
});
