import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("registers the IM Hub card in the official configurable plugins slot", async () => {
  const client = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");

  assert.match(client, /ctx\.slots\.inject\("settings\.plugin\.item"/);
  assert.match(client, /name: "settings\.plugin\.item"/);
  assert.doesNotMatch(client, /web-ui\.plugin\.item/);
});

test("declares the settings transport before mounting the client card", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const inject = pkg.dsh.client.inject;
  const client = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");

  assert.ok(inject.includes("@deepseek-ai/dsh-client-connection"));
  assert.ok(inject.includes("@deepseek-ai/dsh-api-remotes"));
  assert.equal(pkg.peerDependencies["@deepseek-ai/dsh-client-connection"], "^0.1.0-rc.6");
  assert.equal(pkg.peerDependencies["@deepseek-ai/dsh-api-remotes"], "^0.1.0-rc.6");
  assert.match(client, /const inject = \["slots", "settingsScope", "locale", "connection", "remote"\]/);
});

test("waits for the host settings service before registering IM Hub settings", async () => {
  const host = await readFile(new URL("../lib/index.js", import.meta.url), "utf8");

  assert.match(host, /export const inject = \['agentDefaultModel', 'agents', 'sessions', 'loader', 'settings'\]/);
  assert.match(host, /ctx\.settings\.register\(SETTINGS_NAMESPACE, flatSchema/);
});

test("shows readable labels and fill-in examples for every blank configuration input", async () => {
  const client = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");

  assert.match(client, /const readabilityCss =/);
  assert.match(client, /\.imHub_input::placeholder/);
  assert.match(client, /const \{ spec, kind, labelKey, hintKey, placeholderKey,/);
  assert.match(client, /label: t\(labelKey\)/);
  assert.match(client, /placeholder: placeholderKey \? t\(placeholderKey\) : ""/);
  assert.match(client, /labelKey: entry\.labelKey/);
  assert.match(client, /hintKey: entry\.hintKey/);
  assert.match(client, /placeholderKey: entry\.placeholderKey/);
  assert.match(client, /placeholder: props\.placeholder \?\? ""/);
  assert.match(client, /"p\.telegramToken":/);
  assert.match(client, /"p\.feishuAppId":/);
  assert.match(client, /"p\.wecomEncodingAesKey":/);
  assert.match(client, /"p\.agentCwd":/);
  assert.match(client, /"p\.httpPort":/);
});
