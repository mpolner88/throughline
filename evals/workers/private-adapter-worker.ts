const adapterPath = Deno.args[0];
if (!adapterPath) throw new Error("adapter_path_required");

const inputText = await new Response(Deno.stdin.readable).text();
const input = JSON.parse(inputText);
const adapterModule = await import(new URL(`file://${adapterPath}`).href);
const predict = adapterModule.default ?? adapterModule.predict;
if (typeof predict !== "function") throw new Error("adapter_export_invalid");
const output = await predict(input);
await Deno.stdout.write(
  new TextEncoder().encode(`${JSON.stringify(output)}\n`),
);
