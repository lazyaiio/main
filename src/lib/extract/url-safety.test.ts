import { describe, expect, it } from "vitest";
import { ExtractError } from "./errors";
import { isPrivateIp } from "./ip";
import { assertPublicAddresses, parseUserUrl } from "./url-safety";

function kindOf(fn: () => unknown): string {
  try {
    fn();
    return "none";
  } catch (error) {
    return error instanceof ExtractError ? error.kind : "other";
  }
}

describe("parseUserUrl", () => {
  it("accepts normal public addresses and adds https when missing", () => {
    expect(parseUserUrl("https://example.com/article?id=1#top").href).toBe("https://example.com/article?id=1");
    expect(parseUserUrl("example.com/post").href).toBe("https://example.com/post");
    expect(parseUserUrl("  http://news.example.co.uk/a  ").hostname).toBe("news.example.co.uk");
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "   ", "http://", "https://exa mple.com", "http://exa\nmple.com", `https://${"a".repeat(2100)}.com`]) {
      expect(kindOf(() => parseUserUrl(bad))).toBe("invalid_url");
    }
  });

  it("rejects non-web schemes", () => {
    for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "ftp://example.com/x", "data:text/html,hi", "gopher://example.com"]) {
      expect(kindOf(() => parseUserUrl(bad))).toBe("unsupported_scheme");
    }
  });

  it("blocks localhost, private names, and single-label hosts", () => {
    for (const bad of [
      "http://localhost/", "http://localhost:3000/", "http://app.localhost/", "http://printer.local/", "http://metadata.google.internal/",
      "http://intranet/", "http://server.lan/", "http://corp.home.arpa/",
    ]) {
      expect(kindOf(() => parseUserUrl(bad))).toBe("blocked_destination");
    }
  });

  it("blocks every kind of IP address, including disguised ones", () => {
    for (const bad of [
      "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://172.16.0.1/", "http://169.254.169.254/latest/meta-data/",
      "http://2130706433/", "http://0x7f.1/", "http://127.1/", "http://0177.0.0.1/", "http://[::1]/", "http://[fe80::1]/",
      "http://[::ffff:127.0.0.1]/", "http://8.8.8.8/", "http://[2606:4700::1111]/",
    ]) {
      expect(kindOf(() => parseUserUrl(bad))).toBe("blocked_destination");
    }
  });

  it("blocks credentials in the address and unusual ports", () => {
    expect(kindOf(() => parseUserUrl("https://user:pass@example.com/"))).toBe("blocked_destination");
    expect(kindOf(() => parseUserUrl("https://example.com:8080/"))).toBe("blocked_destination");
    expect(kindOf(() => parseUserUrl("http://example.com:22/"))).toBe("blocked_destination");
    expect(parseUserUrl("https://example.com:443/x").href).toBe("https://example.com/x");
  });
});

describe("isPrivateIp", () => {
  it("flags private, loopback, link-local, and reserved IPv4", () => {
    for (const ip of ["0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.5", "172.31.255.255", "192.168.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it("allows ordinary public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "100.63.255.255"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });

  it("flags private and special IPv6, including embedded IPv4", () => {
    for (const ip of ["::", "::1", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "2002:7f00:1::1", "2001:db8::1", "2001::1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it("allows public IPv6 and treats unparseable values as unsafe", () => {
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
    expect(isPrivateIp("2a00:1450:4001:81b::200e")).toBe(false);
    expect(isPrivateIp("not-an-ip")).toBe(true);
    expect(isPrivateIp("fe80::1%eth0")).toBe(true);
  });
});

describe("assertPublicAddresses", () => {
  it("blocks when any answer is private (DNS rebinding style) and when there are none", () => {
    expect(kindOf(() => assertPublicAddresses(["93.184.216.34", "127.0.0.1"]))).toBe("blocked_destination");
    expect(kindOf(() => assertPublicAddresses([]))).toBe("dns_failed");
    expect(kindOf(() => assertPublicAddresses(["93.184.216.34", "2606:4700::6810:84e5"]))).toBe("none");
  });
});
