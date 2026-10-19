import test from "node:test";
import assert from "node:assert/strict";
import { createComposePlan, preflightComposePlan } from "../lib/compose-plan.mjs";

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

test("preflight detects existing names and occupied or duplicate ports without changing state", () => {
  const plan = createComposePlan(`
name: demo
services:
  web:
    image: example/web
    ports: ["8080:80"]
  admin:
    image: example/admin
    ports: ["8080:8080"]
`);
  const result = preflightComposePlan(plan, [
    { name: "demo-web", ports: [] },
    { name: "other", ports: [{ hostPort: 8080, containerPort: 80, protocol: "tcp" }] },
  ]);
  assert.equal(result.readOnly, true);
  assert.equal(result.ready, false);
  assert.deepEqual(new Set(result.conflicts.map((item) => item.code)), new Set(["container-name-in-use", "host-port-in-use", "planned-port-conflict"]));
  assert.deepEqual(result.checks, { existingContainers: 2, plannedContainers: 2, publishedPorts: 1 });
});

test("preflight accepts an available plan and keeps UDP separate from TCP", () => {
  const plan = createComposePlan("services:\n  dns:\n    image: example/dns\n    ports: [\"5353:53/udp\"]");
  const result = preflightComposePlan(plan, [{ name: "web", ports: [{ hostPort: 5353, protocol: "tcp" }] }]);
  assert.equal(result.ready, true);
  assert.equal(result.conflicts.length, 0);
});
