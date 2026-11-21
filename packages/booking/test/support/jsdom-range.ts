// jsdom measures no text: its Range has no boxes. The page's title measures
// its own words with one (MeetTitle), so here they measure as nothing, as an
// element's box does in jsdom.
const empty = () => new DOMRect(0, 0, 0, 0);
Range.prototype.getBoundingClientRect ??= empty;
Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
