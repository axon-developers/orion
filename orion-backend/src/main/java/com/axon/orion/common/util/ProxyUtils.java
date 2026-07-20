package com.axon.orion.common.util;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Utility for building ProxySelectors and matching complex corporate non-proxy host patterns.
 * Supports comma/semicolon/pipe separated patterns, wildcard prefixes (*.org.com),
 * leading dot notation (.org.com), and exact hostnames or IP addresses.
 */
public class ProxyUtils {

    /**
     * Parses a raw bypass string into a clean list of individual bypass patterns.
     */
    public static List<String> parseBypassPatterns(String nonProxyHosts) {
        if (nonProxyHosts == null || nonProxyHosts.isBlank()) {
            return List.of();
        }
        return Arrays.stream(nonProxyHosts.split("[,;|]"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    /**
     * Checks if a target hostname matches any pattern in the nonProxyHosts list.
     */
    public static boolean isHostBypassed(String host, String nonProxyHosts) {
        if (host == null || host.isBlank()) {
            return false;
        }
        List<String> patterns = parseBypassPatterns(nonProxyHosts);
        if (patterns.isEmpty()) {
            return false;
        }

        String targetHost = host.trim().toLowerCase();

        for (String rawPattern : patterns) {
            if (matchesPattern(targetHost, rawPattern)) {
                return true;
            }
        }
        return false;
    }

    private static boolean matchesPattern(String targetHost, String rawPattern) {
        String pattern = rawPattern.trim().toLowerCase();

        // Strip leading wildcards or dots (*.org.com -> org.com, .org.com -> org.com, *org.com -> org.com)
        if (pattern.startsWith("*.")) {
            pattern = pattern.substring(2);
        } else if (pattern.startsWith(".")) {
            pattern = pattern.substring(1);
        } else if (pattern.startsWith("*")) {
            pattern = pattern.substring(1);
        }

        if (pattern.isEmpty()) {
            return false;
        }

        // 1. Exact match (e.g., "localhost" == "localhost" or "org.com" == "org.com")
        if (targetHost.equals(pattern)) {
            return true;
        }

        // 2. Subdomain match (e.g., "api.test.org.com" matches "org.com" via ".org.com")
        if (targetHost.endsWith("." + pattern)) {
            return true;
        }

        return false;
    }

    /**
     * Creates a standard Java ProxySelector using wildcard-aware bypass matching.
     */
    public static ProxySelector createProxySelector(String host, int port, String type, String nonProxyHosts) {
        Proxy.Type proxyType = "SOCKS5".equalsIgnoreCase(type) ? Proxy.Type.SOCKS : Proxy.Type.HTTP;
        Proxy proxy = new Proxy(proxyType, new InetSocketAddress(host, port));

        return new ProxySelector() {
            @Override
            public List<Proxy> select(URI uri) {
                if (uri != null && uri.getHost() != null) {
                    if (isHostBypassed(uri.getHost(), nonProxyHosts)) {
                        return List.of(Proxy.NO_PROXY);
                    }
                }
                return List.of(proxy);
            }

            @Override
            public void connectFailed(URI uri, SocketAddress sa, IOException ioe) {
                // Handled at connection level
            }
        };
    }
}
