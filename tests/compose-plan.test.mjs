import test from "node:test";
import assert from "node:assert/strict";
import { createComposePlan } from "../lib/compose-plan.mjs";

test("creates a deterministic read-only stack plan in dependency order", () => {
  const plan = createComposePlan(`
name: Demo Stack
services:
  database:
    image: postgres:17
    volumes: [data:/var/lib/postgresql/data]
    networks: [backend]
    healthcheck:
      test: [CMD, pg_isready]
  web:
    image: example/web:v1
    depends_on: [database]
    ports: ["8080:80"]
    networks: [backend]
volumes:
  data: {}
networks:
  backend: {}
`);

  assert.equal(plan.readOnly, true);
  assert.equal(plan.ready, true);
  assert.equal(plan.stackName, "demo-stack");
  assert.deepEqual(plan.phases.start, ["demo-stack-database", "demo-stack-web"]);
  assert.deepEqual(plan.phases.stop, ["demo-stack-web", "demo-stack-database"]);
  assert.equal(plan.phases.create[0].volumes[0].source, "demo-stack-data");
  assert.deepEqual(plan.phases.create[0].networks, ["demo-stack-backend"]);
  assert.match(plan.planId, /^[a-f0-9]{16}$/);
});

test("blocks execution planning when a Compose setting could be lost", () => {
  const plan = createComposePlan(`
services:
  api:
    image: example/api
    command: [serve]
    env_file: [api.env]
`);
  assert.equal(plan.ready, false);
  assert.deepEqual(new Set(plan.decisions.map((item) => item.code)), new Set(["env-file-reference", "unreviewed-service-field"]));
});

test("never returns interpolated secret values in a plan", () => {
  const plan = createComposePlan("services:\n  api:\n    image: example/api:${API_TOKEN}", { envSource: "API_TOKEN=do-not-return" });
  assert.doesNotMatch(JSON.stringify(plan), /do-not-return/);
});
