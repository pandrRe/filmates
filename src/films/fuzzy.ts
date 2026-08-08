export function matchesQuery(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  const haystack = text.toLowerCase();
  let position = 0;
  for (const character of needle) {
    if (character === " ") {
      continue;
    }
    const found = haystack.indexOf(character, position);
    if (found === -1) {
      return false;
    }
    position = found + 1;
  }
  return true;
}
