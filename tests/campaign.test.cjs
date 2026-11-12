const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const source = html.match(/<script id="saltline-campaign">([\s\S]*?)<\/script>/)[1];
const context = {};
vm.runInNewContext(source + "\nglobalThis.EchoMission = SaltlineEchoMission;", context);
const Mission = context.EchoMission;

function recover(mission) {
  assert.equal(mission.interact(3, true, true), "recovered");
}

test("black box requires being nearby and holding interact", () => {
  const mission = new Mission();
  assert.equal(mission.interact(10, true, false), null);
  assert.equal(mission.interact(10, false, true), null);
  assert.equal(mission.stage, 0);
  assert.equal(mission.interact(1.5, true, true), null);
  assert.equal(mission.progress, 0.5);
  assert.equal(mission.interact(1.5, true, true), "recovered");
  assert.equal(mission.stage, 1);
  assert.equal(mission.checkpoint, 1);
});

test("interrupted interaction loses progress", () => {
  const mission = new Mission();
  mission.interact(1.5, true, true);
  mission.interact(1, false, true);
  assert.equal(mission.progress, 0);
  assert.equal(mission.stage, 0);
});

test("upload requires activation and 45 seconds within its radius", () => {
  const mission = new Mission();
  recover(mission);
  assert.equal(mission.updateUpload(50, true), false);
  assert.equal(mission.stage, 1);
  assert.equal(mission.interact(2.4, true, true), "upload-started");
  assert.equal(mission.interact(20, true, true), null);
  assert.equal(mission.updateUpload(20, true), false);
  assert.equal(mission.uploadRemaining, 25);
  assert.equal(mission.updateUpload(30, false), false);
  assert.equal(mission.uploadRemaining, 25);
  assert.equal(mission.updateUpload(25, true), true);
  assert.equal(mission.stage, 2);
  assert.equal(mission.checkpoint, 2);
});

test("retry preserves completed stages and restarts an interrupted upload", () => {
  const mission = new Mission();
  recover(mission);
  mission.interact(2.4, true, true);
  mission.updateUpload(20, true);
  mission.reset(true);
  assert.equal(mission.stage, 1);
  assert.equal(mission.uploading, false);
  assert.equal(mission.uploadRemaining, 45);
  assert.equal(mission.progress, 0);
});

test("upload completion survives retry and shutdown cannot be skipped", () => {
  const mission = new Mission();
  recover(mission);
  mission.interact(2.4, true, true);
  mission.updateUpload(45, true);
  mission.reset(true);
  assert.equal(mission.stage, 2);
  assert.equal(mission.interact(10, false, true), null);
  assert.equal(mission.interact(3.5, true, true), "shutdown");
  assert.equal(mission.stage, 3);
  assert.equal(mission.interact(10, true, true), null);
  assert.equal(mission.updateUpload(10, true), false);
  mission.reset(true);
  assert.equal(mission.stage, 3);
});

test("restarting the chapter clears all checkpoints", () => {
  const mission = new Mission();
  recover(mission);
  mission.reset(false);
  assert.equal(mission.stage, 0);
  assert.equal(mission.checkpoint, 0);
  assert.equal(mission.uploading, false);
  assert.equal(mission.uploadRemaining, 45);
});
