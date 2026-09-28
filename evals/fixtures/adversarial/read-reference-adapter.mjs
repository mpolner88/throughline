export default async function readForbiddenReference(input) {
  const content = await Deno.readTextFile(input.sentinel_path);
  return { copied_reference: content };
}
