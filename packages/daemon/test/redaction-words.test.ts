/** Redaction hides credentials, not ordinary words that happen to follow "Basic" or "Token". */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { redact } from "../src/security/redaction.js";
import { PathJail } from "../src/security/pathJail.js";
import { readFile } from "../src/workspace/fileService.js";

describe("reading source files for the model", () => {
  it("returns code exactly, so patches copied from it match (Calendar test 8 AuthScreen)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-read-"));
    const code = "export const AuthScreen: React.FC = () => {\n  const handlePasswordReset = async () => {};\n";
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src/AuthScreen.tsx"), code);
    fs.writeFileSync(path.join(root, "settings.yml"), "auth_token: abc123xyz\n");
    const jail = new PathJail(root);
    expect(readFile(jail, "src/AuthScreen.tsx").content).toBe(code);
    expect(readFile(jail, "settings.yml").content).toBe("auth_token: [REDACTED]\n");
  });
});

describe("redaction of auth schemes", () => {
  it("keeps plain words after Basic, Bearer or Token, and still hides real credentials", () => {
    expect(redact("Build the first version of the Basic Calendar App described in the attached PRD.")).toBe("Build the first version of the Basic Calendar App described in the attached PRD.");
    expect(redact("Token management screen")).toBe("Token management screen");
    expect(redact("Authorization header: Basic dXNlcjpwYXNzd29yZA==")).toContain("Basic [REDACTED]");
    expect(redact("curl -H 'X: Bearer abc.def.ghi1234567'")).toContain("Bearer [REDACTED]");
    expect(redact("Bearer abcdefghijklmnopqrstuvwxyz")).toBe("Bearer [REDACTED]");
  });

  it("keeps TypeScript annotations on auth/password names, and still hides real values (Calendar test 8)", () => {
    const code = [
      "export const AuthScreen: React.FC = () => {",
      "  signUp(userData: { email: string; password: string; name?: string }): Promise<AuthUser>;",
      "  const body = { email, password: password };",
      "  authState: AuthState[];",
    ].join("\n");
    expect(redact(code)).toBe(code);
    expect(redact("password: hunter2")).toBe("password: [REDACTED]");
    expect(redact("API_KEY=AbcDef")).toBe("API_KEY=[REDACTED]");
    expect(redact("db_password: Secret99")).toBe("db_password: [REDACTED]");
    expect(redact('password: "string"')).toBe('password: "[REDACTED]"');
  });

  it("shows source code to the model unchanged in code mode, but still hides real secrets in it", () => {
    const src = "  const handlePasswordReset = async () => {\n  const token = getToken();\n  authUser = user;";
    expect(redact(src)).not.toBe(src);
    expect(redact(src, [], { code: true })).toBe(src);
    expect(redact('const apiKey = "sk-proj-abcdefghijklmnopqrstuvwx";', [], { code: true })).not.toContain("abcdefghij");
    expect(redact("const password = 'hunter2';", [], { code: true })).toBe("const password = '[REDACTED]';");
  });
});
