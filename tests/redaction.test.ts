import { describe, expect, it } from "vitest";
import { detectIdentifyingDetails, redactAll } from "@/lib/redaction";

describe("identifying detail detection", () => {
  it("finds phone numbers, emails and ID numbers and redacts only on request", () => {
    const t = "Mera naam Ayesha hai. Mera number 0300-1234567 hai, email a.b@example.com, CNIC 35202-1234567-1.";
    const found = detectIdentifyingDetails(t);
    expect(found.map((f) => f.kind)).toEqual(expect.arrayContaining(["phone", "email", "id_number", "name"]));
    const red = redactAll(t, found);
    expect(red).not.toMatch(/0300|example\.com|35202|Ayesha/);
    expect(t).toContain("Ayesha");
  });
});
