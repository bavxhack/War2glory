import researchAtlas from '../assets/research-technologies.webp';

const positions = {
  forestry: [0, 0], masonry: [1, 0], agriculture: [2, 0],
  oilProcessing: [0, 1], motorization: [1, 1], logistics: [2, 1],
  constructionEngineering: [0, 2], trainingTechniques: [1, 2], loadingTechniques: [2, 2],
};

export function ResearchArt({ technology, label }) {
  const position = positions[technology];
  if (!position) return null;
  return <span className="research-art" role="img" aria-label={`Forschungsmotiv: ${label}`}
    style={{ backgroundImage: `url(${researchAtlas})`, backgroundPosition: `${position[0] * 50}% ${position[1] * 50}%` }}/>;
}
