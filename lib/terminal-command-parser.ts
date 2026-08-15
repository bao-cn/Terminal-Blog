export function splitCommand(value: string) {
  return (value.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map((part) => part.replace(/^"|"$/g, ""));
}

export function splitPipeline(value: string) {
  const stages: string[] = [];
  let current = "";
  let quoted = false;
  for (const character of value) {
    if (character === '"') quoted = !quoted;
    if (character === "|" && !quoted) {
      stages.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  stages.push(current.trim());
  return stages;
}
