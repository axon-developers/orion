package com.axon.orion.execution.controller;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@RestController
public class RecordingProxyController {

    private final RestClient restClient = RestClient.create();

    @GetMapping(value = "/api/record/proxy")
    public ResponseEntity<byte[]> proxyUrl(@RequestParam String url) {
        try {
            log.info("Proxying request for URL: {}", url);

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
}
