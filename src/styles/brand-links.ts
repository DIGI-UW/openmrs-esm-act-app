/**
 * Points Carbon's link colours at O3's configured brand colours, which esm-styleguide sets on the root element without
 * mapping them to links. Each is a var() reference, so a brand colour the config changes later is followed.
 */
export function linkColoursFromBrand() {
  const style = document.documentElement.style;
  style.setProperty('--cds-link-primary', 'var(--brand-01)');
  style.setProperty('--cds-link-primary-hover', 'var(--brand-02)');
  style.setProperty('--cds-link-visited', 'var(--brand-01)');
  // A light shade for links on a dark surface, such as a toggletip, where every brand colour is too dark to read.
  style.setProperty('--cds-link-inverse', 'color-mix(in srgb, var(--brand-01) 40%, white)');
}
