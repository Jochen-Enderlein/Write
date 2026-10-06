/** Public addresses of the project, used in the app and kept in one place. */
const REPO = 'https://github.com/Jochen-Enderlein/Write'

export const LINKS = {
  repo: REPO,
  issues: `${REPO}/issues`,
  license: `${REPO}/blob/main/LICENSE`,
  /** Every version's notes and downloads (GitHub Releases, tagged `v1.2.3`). */
  releases: `${REPO}/releases`,
  /** Full privacy policy (Art. 13 GDPR); the app shows a short summary. */
  privacy: `${REPO}/blob/main/DATENSCHUTZ.md`,
  /** Provider identification (§ 5 DDG), shared with the author's other projects. */
  impressum: 'https://beerball.jochens-toller-server.de/impressum'
} as const
