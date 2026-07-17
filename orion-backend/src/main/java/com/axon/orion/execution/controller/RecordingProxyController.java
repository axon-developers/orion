package com.axon.orion.execution.controller;

import com.axon.orion.admin.service.SystemSettingsService;
import com.axon.orion.config.OrionSslContextFactory;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import javax.net.ssl.SSLContext;
import java.net.Authenticator;
import java.net.InetSocketAddress;
import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Proxies external URLs through the Orion backend so that the browser-based
 * recording sandbox can load both HTTP and HTTPS target sites.
 *
 * <p>SSL is established using the bundled {@code orion-truststore.jks}
 * (via {@link OrionSslContextFactory}), which includes all standard JDK
 * root CAs plus the Orion self-signed certificate.
 *
 * <p>If a system proxy is configured (proxy.enabled=true in System Settings)
 * the recording proxy will tunnel its outbound requests through that proxy,
 * matching the behaviour of all other Orion executors.
 */
@Slf4j
@RestController
public class RecordingProxyController {

    private final OrionSslContextFactory orionSslContextFactory;
    private final SystemSettingsService systemSettingsService;

    public RecordingProxyController(OrionSslContextFactory orionSslContextFactory,
                                    SystemSettingsService systemSettingsService) {
        this.orionSslContextFactory = orionSslContextFactory;
        this.systemSettingsService = systemSettingsService;
    }

    @GetMapping(value = "/api/record/proxy")
    public ResponseEntity<byte[]> proxyUrl(@RequestParam String url) {
        try {
            log.info("Proxying request for URL: {}", url);

            // Build a fresh RestClient per request so live proxy setting changes
            // take effect without requiring an application restart.
            RestClient restClient = buildRestClient();

            ResponseEntity<byte[]> response = restClient.get()
                    .uri(new URI(url))
                    .retrieve()
                    .toEntity(byte[].class);

            MediaType contentType = response.getHeaders().getContentType();
            byte[] bodyBytes = response.getBody();

            if (bodyBytes == null) {
                return ResponseEntity.noContent().build();
            }

            if (contentType != null && contentType.includes(MediaType.TEXT_HTML)) {
                String html = new String(bodyBytes, StandardCharsets.UTF_8);
                Document doc = Jsoup.parse(html, url);
                doc.select("base").remove();

                rewriteAttributes(doc.select("link[href]"), "href");
                rewriteAttributes(doc.select("script[src]"), "src");
                rewriteAttributes(doc.select("img[src]"), "src");
                rewriteAttributes(doc.select("form[action]"), "action");
                rewriteAttributes(doc.select("a[href]"), "href");

                // Inject recorder script
                Element body = doc.body();
                if (body != null) {
                    body.append("<script src=\"/api/record/recorder.js\"></script>");
                }

                byte[] modifiedBytes = doc.outerHtml().getBytes(StandardCharsets.UTF_8);
                return ResponseEntity.ok()
                        .contentType(MediaType.TEXT_HTML)
                        .body(modifiedBytes);
            }

            return ResponseEntity.ok()
                    .contentType(contentType != null ? contentType : MediaType.APPLICATION_OCTET_STREAM)
                    .body(bodyBytes);

        } catch (Exception e) {
            log.error("Failed to proxy URL {}: {}", url, e.getMessage(), e);
            byte[] errorBytes = ("Proxy Error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(errorBytes);
        }
    }

    private void rewriteAttributes(Elements elements, String attributeName) {
        for (Element element : elements) {
            String absUrl = element.absUrl(attributeName);
            if (absUrl != null && !absUrl.isBlank() && !absUrl.startsWith("javascript:")) {
                try {
                    String encodedUrl = URLEncoder.encode(absUrl, StandardCharsets.UTF_8);
                    element.attr(attributeName, "/api/record/proxy?url=" + encodedUrl);
                } catch (Exception e) {
                    log.warn("Failed to encode rewritten URL: {}", absUrl);
                }
            }
        }
    }

    @GetMapping(value = "/api/record/recorder.js", produces = "application/javascript")
    public ResponseEntity<String> getRecorderJs() {
        try {
            java.io.InputStream is = getClass().getResourceAsStream("/static/recorder.js");
            if (is == null) {
                return ResponseEntity.notFound().build();
            }
            String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            return ResponseEntity.ok(content);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Builds a {@link RestClient} backed by the Orion bundled truststore and
     * configured with the system proxy settings (if proxy.enabled=true).
     * A new instance is created per request so proxy setting changes
     * take effect without restarting the application.
     */
    private RestClient buildRestClient() {
        SSLContext sslContext = orionSslContextFactory.getOrionSslContext();
        HttpClient.Builder builder = HttpClient.newBuilder()
                .sslContext(sslContext)
                .followRedirects(HttpClient.Redirect.NORMAL);

        if (systemSettingsService.getBoolean("proxy.enabled", false)) {
            String proxyHost     = systemSettingsService.getString("proxy.host", "");
            int    proxyPort     = systemSettingsService.getInt("proxy.port", 8080);
            String proxyType     = systemSettingsService.getString("proxy.type", "HTTP");
            String nonProxyHosts = systemSettingsService.getString("proxy.nonProxyHosts", "");
            String proxyUsername = systemSettingsService.getString("proxy.username", "");
            String proxyPassword = systemSettingsService.getString("proxy.password", "");

            if (!proxyHost.isBlank()) {
                log.debug("Recording proxy: routing through {} proxy {}:{}", proxyType, proxyHost, proxyPort);
                builder.proxy(buildProxySelector(proxyHost, proxyPort, proxyType, nonProxyHosts));
                if (!proxyUsername.isBlank()) {
                    builder.authenticator(new Authenticator() {
                        @Override
                        protected PasswordAuthentication getPasswordAuthentication() {
                            if (getRequestorType() == Authenticator.RequestorType.PROXY) {
                                return new PasswordAuthentication(proxyUsername, proxyPassword.toCharArray());
                            }
                            return null;
                        }
                    });
                }
            }
        }

        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(builder.build());
        return RestClient.builder()
                .requestFactory(factory)
                // Request uncompressed responses so HTML rewriting works reliably
                .defaultHeader("Accept-Encoding", "identity")
                .build();
    }

    /**
     * Builds a {@link ProxySelector} that routes all requests through the
     * given proxy host/port, bypassing hosts listed in {@code nonProxyHosts}.
     */
    private ProxySelector buildProxySelector(String host, int port, String type, String nonProxyHosts) {
        Proxy.Type proxyType = "SOCKS5".equalsIgnoreCase(type) ? Proxy.Type.SOCKS : Proxy.Type.HTTP;
        Proxy proxy = new Proxy(proxyType, new InetSocketAddress(host, port));
        List<String> bypass = nonProxyHosts == null ? List.of()
                : List.of(nonProxyHosts.split(","));
        return new ProxySelector() {
            @Override
            public List<Proxy> select(URI uri) {
                for (String h : bypass) {
                    if (uri.getHost() != null && uri.getHost().endsWith(h.trim())) {
                        return List.of(Proxy.NO_PROXY);
                    }
                }
                return List.of(proxy);
            }
            @Override
            public void connectFailed(URI uri, SocketAddress sa, java.io.IOException e) {
                log.warn("Recording proxy: connect failed to {} via {}: {}", uri, sa, e.getMessage());
            }
        };
    }
}