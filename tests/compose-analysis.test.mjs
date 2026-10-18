import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCompose, parseComposeEnv } from "../lib/compose-analysis.mjs";

test("compose analysis preserves services, dependencies, profiles and healthchecks", () => {
  const result = analyzeCompose(`
services:
  database:
    image: postgres:\${POSTGRES_TAG:-17}
    environment:
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - data:/var/lib/postgresql/data
    healthcheck:
      test: [CMD, pg_isready]
  web:
    image: registry.opencode.de/example/web:\${WEB_TAG}
    depends_on:
      database:
        condition: service_healthy
    ports:
      - "8080:80"
    profiles: [frontend]
networks:
  default: {}
volumes:
  data: {}
`, { envSource: "DB_PASSWORD=very-secret\nWEB_TAG=v1.2.3", profiles: ["frontend"] });

  assert.equal(result.compatible, true);
  assert.deepEqual(result.startOrder, ["database", "web"]);
  assert.deepEqual(result.profiles, { available: ["frontend"], selected: ["frontend"] });
  assert.equal(result.services[0].healthcheck, true);
  assert.deepEqual(result.services[1].ports, ["8080:80"]);
  assert.deepEqual(result.volumes, ["data"]);
  assert.deepEqual(result.services[0].environment, [{ name: "POSTGRES_PASSWORD", secret: true }]);
  assert.doesNotMatch(JSON.stringify(result), /very-secret/);
});

test("secret variables stay masked even when used in another Compose field", () => {
  const result = analyzeCompose("services:\n  api:\n    image: example/api\n    command: https://user:${API_TOKEN}@example.invalid", { envSource: "API_TOKEN=do-not-return" });
  assert.doesNotMatch(JSON.stringify(result), /do-not-return/);
});

test("compose analysis reports unsafe and unsupported settings without changing anything", () => {
  const result = analyzeCompose(`
services:
  unsafe:
    build: .
    privileged: true
    network_mode: host
    depends_on: [missing]
`);
  assert.equal(result.readOnly, true);
  assert.equal(result.compatible, false);
  assert.deepEqual(new Set(result.diagnostics.map((item) => item.code)), new Set(["unknown-dependency", "build-required", "privileged", "host-network"]));
});

test("env parsing supports exports and never requires values to be returned", () => {
  assert.deepEqual(parseComposeEnv("export IMAGE_TAG=v2\n# note\nNAME='demo'"), { values: { IMAGE_TAG: "v2", NAME: "demo" }, warnings: [] });
});

test("compose analysis rejects malformed documents and dependency cycles", () => {
  assert.throws(() => analyzeCompose("services: [broken"), /ungültig/);
  const result = analyzeCompose("services:\n  a:\n    image: a\n    depends_on: [b]\n  b:\n    image: b\n    depends_on: [a]");
  assert.equal(result.compatible, false);
  assert.equal(result.startOrder.length, 0);
  assert.ok(result.diagnostics.some((item) => item.code === "dependency-cycle"));
});
