import { REPO } from "../constants/branding";

export function GitHubStarCard() {
  return (
    <a
      className="github-star-card"
      href={REPO.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="github-star-card-label">Open source</span>
      <strong>{REPO.title}</strong>
      <p>{REPO.lead}</p>
      <p className="github-star-card-cta">{REPO.cta}</p>
      <span className="github-star-card-button">{REPO.button}</span>
    </a>
  );
}
