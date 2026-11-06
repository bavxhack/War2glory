import { useState } from 'react';
export function AllianceEmblem({ image, tag, className = '', label }) {
  const [failed,setFailed]=useState(null);
  const url=typeof image?.url==='string' && /^\/alliance-images\/[a-f0-9-]{36}\/[a-f0-9]{64}\.webp$/.test(image.url) ? image.url : null;
  return <span className={`alliance-emblem ${className}`} role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true}>
    {url && failed!==url ? <img src={url} width="256" height="256" alt="" decoding="async" onError={()=>setFailed(url)}/> : <span className="alliance-emblem-fallback">⚑{tag && <small>{tag}</small>}</span>}
  </span>;
}
