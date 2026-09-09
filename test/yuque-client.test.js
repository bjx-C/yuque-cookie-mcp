"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { YuqueClient } = require("../yuque-client.js");

test("updateDocLake uses Yuque's native Lake editor save payload", async () => {
  const calls = [];
  const client = Object.create(YuqueClient.prototype);
  client.authType = "cookie";
  client.client = {
    async put(url, data) {
      calls.push({ url, data });
      return { data: { data: { id: data.id } } };
    },
  };

  const lake = '<!doctype lake><h2>盐水类</h2>';
  await client.updateDocLake(42, lake, 7);

  assert.deepEqual(calls, [
    {
      url: "/api/docs/42",
      data: {
        id: 42,
        format: "lake",
        body_asl: lake,
        draft_version: 7,
        sync_dynamic_data: false,
        save_type: "user",
        edit_type: "lake",
      },
    },
  ]);
});

test("updateDocLake marks documents without a draft version", async () => {
  let payload;
  const client = Object.create(YuqueClient.prototype);
  client.authType = "cookie";
  client.client = {
    async put(_url, data) {
      payload = data;
      return { data: { data: { id: data.id } } };
    },
  };

  await client.updateDocLake(9, "<!doctype lake><p>内容</p>", 0);
  assert.equal(payload._without_draft_version, 1);
});

test("updateDocLake refuses non-Lake content", async () => {
  const client = Object.create(YuqueClient.prototype);
  client.authType = "cookie";
  client.client = { put: async () => assert.fail("PUT must not be called") };

  await assert.rejects(() => client.updateDocLake(9, "# Markdown"), /不是有效的 Lake/);
});
